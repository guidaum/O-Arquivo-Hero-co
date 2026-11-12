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
use App\Support\Assets;
use App\Support\Navigation;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Pagination\Paginator;
use Illuminate\Support\Facades\Blade;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\View;
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
        $this->configureViews();
        $this->configureModels();
    }

    /**
     * Consultas N+1: fora de produção, carregar uma relação sem eager load
     * num model que veio de uma lista (o caso que gera N+1) é registrado no
     * log com o model, a relação e o endereço, uma vez por pedido. Não lança
     * exceção para não quebrar telas nem testes enquanto os casos antigos
     * são corrigidos. Em produção fica desligado.
     */
    private function configureModels(): void
    {
        Model::preventLazyLoading(! $this->app->isProduction());

        $reported = [];
        Model::handleLazyLoadingViolationUsing(static function (Model $model, string $relation) use (&$reported): void {
            $key = $model::class.'::'.$relation;

            if (isset($reported[$key])) {
                return;
            }
            $reported[$key] = true;

            Log::warning('Consulta N+1: relação carregada sem eager load.', [
                'model' => $model::class,
                'relation' => $relation,
                'url' => app()->runningInConsole() ? 'console' : request()->method().' '.request()->path(),
            ]);
        });
    }

    private function configureViews(): void
    {
        Paginator::defaultView('partials.pagination');

        // @asset('css/app.css'): endereço de public/ com ?v=<data do arquivo> (App\Support\Assets).
        Blade::directive('asset', static fn (string $expression): string => '<?php echo e(\\'.Assets::class.'::url('.$expression.')); ?>');

        // URLs em português nas rotas de recurso: /talentos/criar, /talentos/1/editar.
        Route::resourceVerbs(['create' => 'criar', 'edit' => 'editar']);

        // Menu, modo de visão e dados do usuário do layout autenticado.
        View::composer('components.layouts.app', static function (\Illuminate\View\View $view): void {
            $view->with('navigation', Navigation::for(request()));
        });
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
