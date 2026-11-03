<x-layouts.guest title="Definir senha">
    <form class="form" method="POST" action="{{ route('password.store') }}">
        @csrf

        <input type="hidden" name="token" value="{{ $token }}">

        <x-form.field name="email" label="E-mail" type="email" :value="$email" required autocomplete="username" />
        <x-form.field
            name="password"
            label="Nova senha"
            type="password"
            required
            autofocus
            autocomplete="new-password"
            hint="Mínimo de 8 caracteres, com letras e números."
        />
        <x-form.field name="password_confirmation" label="Confirme a nova senha" type="password" required autocomplete="new-password" />

        <button type="submit" class="button button--block">Salvar senha</button>
    </form>
</x-layouts.guest>
