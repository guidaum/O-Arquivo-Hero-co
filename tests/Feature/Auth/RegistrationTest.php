<?php

declare(strict_types=1);

namespace Tests\Feature\Auth;

use App\Enums\UserRole;
use App\Models\RuleSet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RegistrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_new_users_can_register_as_players(): void
    {
        $this->post('/cadastro', [
            'name' => 'Jogador Teste',
            'email' => 'Novo@Example.com',
            'password' => 'senha-segura-123',
            'password_confirmation' => 'senha-segura-123',
        ])->assertRedirect('/');

        $user = User::query()->where('email', 'novo@example.com')->firstOrFail();
        $this->assertSame(UserRole::User, $user->fresh()->role);
        $this->assertAuthenticatedAs($user);
    }

    public function test_registration_requires_a_strong_password(): void
    {
        $this->post('/cadastro', [
            'name' => 'Jogador Teste',
            'email' => 'novo@example.com',
            'password' => 'curta',
            'password_confirmation' => 'curta',
        ])->assertSessionHasErrors('password');

        $this->assertGuest();
    }

    public function test_registration_stays_open_while_google_login_is_off(): void
    {
        config(['services.google.enabled' => false]);

        $settings = new RuleSet;
        $settings->forceFill(['enable_email_password_auth' => false])->save();

        $this->get('/cadastro')->assertOk();
    }

    public function test_registration_can_be_disabled_in_global_settings(): void
    {
        config([
            'services.google.enabled' => true,
            'services.google.client_id' => 'CLIENT_ID',
            'services.google.client_secret' => 'CLIENT_SECRET',
            'services.google.redirect' => 'http://localhost/auth/google/callback',
        ]);

        $settings = new RuleSet;
        $settings->forceFill(['enable_email_password_auth' => false])->save();

        $this->get('/cadastro')->assertRedirect('/login');

        $this->post('/cadastro', [
            'name' => 'Jogador Teste',
            'email' => 'novo@example.com',
            'password' => 'senha-segura-123',
            'password_confirmation' => 'senha-segura-123',
        ])->assertRedirect('/login');

        $this->assertDatabaseMissing('users', ['email' => 'novo@example.com']);
    }
}
