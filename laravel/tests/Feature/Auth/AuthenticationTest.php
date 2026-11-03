<?php

declare(strict_types=1);

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_screen_can_be_rendered(): void
    {
        $this->get('/login')
            ->assertOk()
            ->assertSee('Entrar')
            ->assertSee('Primeiro acesso');
    }

    public function test_guests_are_redirected_to_login(): void
    {
        $this->get('/')->assertRedirect('/login');
    }

    public function test_users_can_authenticate(): void
    {
        $user = User::factory()->create(['email' => 'jogador@example.com']);

        $this->post('/login', ['email' => 'JOGADOR@example.com', 'password' => 'senha-segura-123'])
            ->assertRedirect('/');

        $this->assertAuthenticatedAs($user);
    }

    public function test_users_can_not_authenticate_with_invalid_password(): void
    {
        $user = User::factory()->create();

        $this->post('/login', ['email' => $user->email, 'password' => 'senha-errada'])
            ->assertSessionHasErrors('email');

        $this->assertGuest();
    }

    public function test_imported_users_without_password_can_not_authenticate(): void
    {
        $user = User::factory()->withoutPassword()->create();

        $this->post('/login', ['email' => $user->email, 'password' => 'qualquer-coisa'])
            ->assertSessionHasErrors(['email' => __('auth.failed')]);

        $this->assertGuest();
    }

    public function test_login_is_throttled_after_too_many_attempts(): void
    {
        $user = User::factory()->create();

        for ($attempt = 0; $attempt < 5; $attempt++) {
            $this->post('/login', ['email' => $user->email, 'password' => 'senha-errada']);
        }

        $this->post('/login', ['email' => $user->email, 'password' => 'senha-segura-123'])
            ->assertSessionHasErrors('email');

        $this->assertGuest();
    }

    public function test_users_can_logout(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->post('/logout')->assertRedirect('/login');

        $this->assertGuest();
    }

    public function test_last_activity_is_tracked(): void
    {
        $user = User::factory()->create(['last_active_at' => null]);

        $this->actingAs($user)->get('/')->assertOk();

        $this->assertNotNull($user->fresh()->last_active_at);
    }
}
