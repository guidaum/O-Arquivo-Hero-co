<?php

declare(strict_types=1);

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;

/**
 * "Primeiro acesso" dos usuários importados e "Esqueci minha senha".
 */
class PasswordSetupTest extends TestCase
{
    use RefreshDatabase;

    public function test_first_access_screen_can_be_rendered(): void
    {
        $this->get('/esqueci-senha?primeiro-acesso=1')
            ->assertOk()
            ->assertSee('Primeiro acesso');
    }

    public function test_reset_link_is_sent_to_imported_user(): void
    {
        Notification::fake();
        $user = User::factory()->withoutPassword()->create();

        $this->post('/esqueci-senha', ['email' => $user->email])
            ->assertSessionHas('status', __('passwords.sent'));

        Notification::assertSentTo($user, ResetPassword::class);
    }

    public function test_unknown_email_gets_the_same_response(): void
    {
        Notification::fake();

        $this->post('/esqueci-senha', ['email' => 'ninguem@example.com'])
            ->assertSessionHas('status', __('passwords.sent'))
            ->assertSessionHasNoErrors();

        Notification::assertNothingSent();
    }

    public function test_reset_email_is_in_portuguese(): void
    {
        Notification::fake();
        $user = User::factory()->withoutPassword()->create();

        $this->post('/esqueci-senha', ['email' => $user->email]);

        Notification::assertSentTo($user, ResetPassword::class, function (ResetPassword $notification) use ($user): bool {
            $mail = $notification->toMail($user);

            return $mail->actionText === 'Definir senha'
                && str_contains($mail->actionUrl, '/redefinir-senha/');
        });
    }

    public function test_imported_user_can_define_password_with_valid_token(): void
    {
        Notification::fake();
        $user = User::factory()->withoutPassword()->unverified()->create();

        $this->post('/esqueci-senha', ['email' => $user->email]);

        Notification::assertSentTo($user, ResetPassword::class, function (ResetPassword $notification) use ($user): bool {
            $this->get('/redefinir-senha/'.$notification->token.'?email='.urlencode($user->email))->assertOk();

            $this->post('/redefinir-senha', [
                'token' => $notification->token,
                'email' => $user->email,
                'password' => 'nova-senha-123',
                'password_confirmation' => 'nova-senha-123',
            ])->assertRedirect('/login')->assertSessionHasNoErrors();

            return true;
        });

        $user->refresh();
        $this->assertTrue(Hash::check('nova-senha-123', $user->password));
        $this->assertNotNull($user->email_verified_at);
    }

    public function test_password_can_not_be_defined_with_invalid_token(): void
    {
        $user = User::factory()->withoutPassword()->create();

        $this->post('/redefinir-senha', [
            'token' => 'token-invalido',
            'email' => $user->email,
            'password' => 'nova-senha-123',
            'password_confirmation' => 'nova-senha-123',
        ])->assertSessionHasErrors('email');

        $this->assertNull($user->fresh()->password);
    }
}
