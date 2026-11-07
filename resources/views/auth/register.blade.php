<x-layouts.guest title="Criar conta">
    <x-google-button />

    <form class="form" method="POST" action="{{ route('register.store') }}">
        @csrf

        <x-form.field name="name" label="Nome" required autofocus autocomplete="name" />
        <x-form.field name="email" label="E-mail" type="email" required autocomplete="username" />
        <x-form.field
            name="password"
            label="Senha"
            type="password"
            required
            autocomplete="new-password"
            hint="Mínimo de 8 caracteres, com letras e números."
        />
        <x-form.field name="password_confirmation" label="Confirme a senha" type="password" required autocomplete="new-password" />

        <button type="submit" class="button button--parchment button--block button--large">Criar conta</button>
    </form>

    <div class="auth__links">
        <span class="muted">Já tem conta? <a href="{{ route('login') }}">Entrar</a></span>
    </div>
</x-layouts.guest>
