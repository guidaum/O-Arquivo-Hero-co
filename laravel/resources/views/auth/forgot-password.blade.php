<x-layouts.guest :title="$firstAccess ? 'Primeiro acesso' : 'Esqueci minha senha'">
    @if ($firstAccess)
        <p class="card__text">
            O sistema mudou de endereço e as senhas antigas não foram transferidas.
            Informe o e-mail da sua conta para receber o link de definição de senha.
            @if (\App\Http\Controllers\Auth\GoogleAuthController::isConfigured())
                Se você entrava com o Google, pode continuar usando o botão "Entrar com Google".
            @else
                Isso vale também para quem entrava com o Google: use o mesmo e-mail da conta Google.
            @endif
        </p>
    @else
        <p class="card__text">Informe o e-mail da sua conta para receber o link de definição de uma nova senha.</p>
    @endif

    <form class="form" method="POST" action="{{ route('password.email') }}">
        @csrf

        <x-form.field name="email" label="E-mail" type="email" required autofocus autocomplete="username" />

        <button type="submit" class="button button--block">Enviar link</button>
    </form>

    <div class="auth__links">
        <a href="{{ route('login') }}">Voltar para o login</a>
    </div>
</x-layouts.guest>
