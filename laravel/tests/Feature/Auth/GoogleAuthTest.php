<?php

declare(strict_types=1);

namespace Tests\Feature\Auth;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class GoogleAuthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'services.google.client_id' => 'CLIENT_ID',
            'services.google.client_secret' => 'CLIENT_SECRET',
            'services.google.redirect' => 'http://localhost/auth/google/callback',
        ]);
    }

    /**
     * @param  array<string, mixed>  $profile
     */
    private function fakeGoogle(array $profile): void
    {
        Http::fake([
            'oauth2.googleapis.com/token' => Http::response(['access_token' => 'ACCESS_TOKEN']),
            'openidconnect.googleapis.com/v1/userinfo' => Http::response($profile),
        ]);
    }

    private function visitCallback(string $state = 'estado-valido'): \Illuminate\Testing\TestResponse
    {
        return $this->withSession(['google_oauth_state' => 'estado-valido'])
            ->get('/auth/google/callback?state='.$state.'&code=CODE');
    }

    public function test_redirect_sends_user_to_google_with_state(): void
    {
        $response = $this->get('/auth/google');

        $response->assertRedirect();
        $this->assertStringStartsWith('https://accounts.google.com/o/oauth2/v2/auth?', $response->headers->get('Location'));
        $this->assertStringContainsString('state='.session('google_oauth_state'), $response->headers->get('Location'));
    }

    public function test_new_google_user_is_created_as_player(): void
    {
        $this->fakeGoogle(['sub' => 'google-123', 'email' => 'Novo@Example.com', 'email_verified' => true, 'name' => 'Novo Jogador']);

        $this->visitCallback()->assertRedirect('/');

        $user = User::query()->where('email', 'novo@example.com')->firstOrFail();
        $this->assertSame('google-123', $user->google_id);
        $this->assertSame(UserRole::User, $user->role);
        $this->assertNull($user->password);
        $this->assertAuthenticatedAs($user);
    }

    public function test_imported_user_is_linked_by_email(): void
    {
        $user = User::factory()->withoutPassword()->gm()->create(['email' => 'mestre@example.com']);
        $this->fakeGoogle(['sub' => 'google-456', 'email' => 'mestre@example.com', 'email_verified' => true]);

        $this->visitCallback()->assertRedirect('/');

        $this->assertSame('google-456', $user->fresh()->google_id);
        $this->assertSame(UserRole::Gm, $user->fresh()->role);
        $this->assertSame(1, User::query()->count());
        $this->assertAuthenticatedAs($user);
    }

    public function test_invalid_state_is_rejected(): void
    {
        $this->fakeGoogle(['sub' => 'google-123', 'email' => 'novo@example.com', 'email_verified' => true]);

        $this->visitCallback('estado-forjado')->assertRedirect('/login')->assertSessionHasErrors('email');

        $this->assertGuest();
        Http::assertNothingSent();
    }

    public function test_unverified_google_email_is_rejected(): void
    {
        $this->fakeGoogle(['sub' => 'google-123', 'email' => 'novo@example.com', 'email_verified' => false]);

        $this->visitCallback()->assertRedirect('/login')->assertSessionHasErrors(['email' => __('auth.google_unverified')]);

        $this->assertGuest();
        $this->assertSame(0, User::query()->count());
    }

    public function test_google_login_is_unavailable_without_configuration(): void
    {
        config(['services.google.client_id' => null]);

        $this->get('/auth/google')->assertRedirect('/login')->assertSessionHasErrors('email');
        $this->get('/login')->assertDontSee('Entrar com Google');
    }
}
