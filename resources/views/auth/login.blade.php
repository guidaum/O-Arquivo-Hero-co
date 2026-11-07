<x-layouts.guest title="Entrar">
    <x-google-button />

    <form class="form" method="POST" action="{{ route('login.store') }}">
        @csrf

        <x-form.field name="email" label="E-mail" type="email" required autofocus autocomplete="username" />
        <x-form.field name="password" label="Senha" type="password" required autocomplete="current-password" />

        <div class="auth__row">
            <label class="checkbox">
                <input type="checkbox" name="remember" value="1" @checked(old('remember'))>
                Manter conectado
            </label>

            <a href="{{ route('password.request') }}">Esqueci minha senha</a>
        </div>

        <button type="submit" class="button button--parchment button--block button--large">Entrar com Senha</button>
    </form>

    <div class="auth__links">
        <a href="{{ route('password.request', ['primeiro-acesso' => 1]) }}">Primeiro acesso ao novo sistema? Defina sua senha</a>

        @if (\App\Http\Controllers\Auth\RegisterController::isEnabled())
            <span class="muted">Ainda não tem conta? <a href="{{ route('register') }}">Cadastre-se</a></span>
        @endif
    </div>
</x-layouts.guest>
