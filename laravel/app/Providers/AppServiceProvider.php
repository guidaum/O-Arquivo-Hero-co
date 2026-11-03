<?php

declare(strict_types=1);

namespace App\Providers;

use App\Models\CatalogItem;
use App\Models\CharacterTrait;
use App\Models\Power;
use App\Models\RoleFeature;
use App\Models\Skill;
use App\Models\Talent;
use App\Models\User;
use App\Policies\GameContentPolicy;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureAuthorization();
        $this->configurePasswords();
    }

    private function configureAuthorization(): void
    {
        // Administradores podem tudo (equivale ao isAdmin() das regras do Firestore).
        Gate::before(static fn (User $user): ?bool => $user->isAdmin() ? true : null);

        Gate::define('access-admin', static fn (User $user): bool => $user->isAdmin());
        Gate::define('use-gm-tools', static fn (User $user): bool => $user->isGm());
        Gate::define('use-feature', static fn (User $user, string $feature): bool => RoleFeature::isEnabled($user->role, $feature));

        foreach ([Talent::class, Skill::class, Power::class, CharacterTrait::class, CatalogItem::class] as $model) {
            Gate::policy($model, GameContentPolicy::class);
        }
    }

    private function configurePasswords(): void
    {
        Password::defaults(static fn (): Password => Password::min(8)->letters()->numbers());

        // O mesmo link serve para "Esqueci minha senha" e para o primeiro acesso
        // dos usuários importados do Firebase, que ainda não têm senha.
        ResetPassword::toMailUsing(static function (User $user, string $token): MailMessage {
            $url = route('password.reset', [
                'token' => $token,
                'email' => $user->getEmailForPasswordReset(),
            ]);
            $minutes = (int) config('auth.passwords.'.config('auth.defaults.passwords').'.expire');

            return (new MailMessage)
                ->subject('Defina sua senha - '.config('app.name'))
                ->greeting('Olá, '.$user->name.'!')
                ->line('Recebemos um pedido para definir a senha da sua conta.')
                ->action('Definir senha', $url)
                ->line("Este link expira em {$minutes} minutos.")
                ->line('Se você não fez este pedido, ignore este e-mail.');
        });
    }
}
