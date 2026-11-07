<x-layouts.app title="Perfil">
    <section class="card">
        <h1 class="card__title">Meu perfil</h1>

        <form class="form" method="POST" action="{{ route('profile.update') }}" enctype="multipart/form-data">
            @csrf
            @method('PUT')

            <x-avatar :user="$user" large />


            <x-form.field name="photo" label="Foto" type="file" accept="image/jpeg,image/png,image/webp" hint="JPG, PNG ou WEBP, até 2 MB." />
            <x-form.field name="name" label="Nome" :value="$user->name" required autocomplete="name" />
            <x-form.field name="email" label="E-mail" type="email" :value="$user->email" disabled hint="O e-mail não pode ser alterado." />
            <x-form.field name="location" label="Localização" :value="$user->location" />
            <x-form.field name="phone_number" label="Telefone" type="tel" :value="$user->phone_number" autocomplete="tel" />
            <x-form.field name="bio" label="Biografia" type="textarea" :value="$user->bio" />

            @if ($user->isAdmin())
                <p class="field__hint">Papel: {{ $user->role->label() }}</p>
            @else
                <fieldset class="field">
                    <legend class="field__label">Papel</legend>
                    <div class="radio-group">
                        @foreach ([\App\Enums\UserRole::User, \App\Enums\UserRole::Gm] as $role)
                            <label class="checkbox">
                                <input type="radio" name="role" value="{{ $role->value }}" @checked(old('role', $user->role->value) === $role->value)>
                                {{ $role->label() }}
                            </label>
                        @endforeach
                    </div>
                    @error('role')
                        <p class="field__error">{{ $message }}</p>
                    @enderror
                </fieldset>
            @endif

            <div>
                <button type="submit" class="button">Salvar perfil</button>
            </div>
        </form>
    </section>

    <section class="card">
        <h2 class="card__title">{{ $user->needsPasswordSetup() ? 'Definir senha' : 'Alterar senha' }}</h2>

        @if ($user->needsPasswordSetup())
            <p class="card__text">Sua conta ainda não tem senha. Defina uma para poder entrar também com e-mail e senha.</p>
        @endif

        <form class="form" method="POST" action="{{ route('profile.password') }}">
            @csrf
            @method('PUT')

            @unless ($user->needsPasswordSetup())
                <x-form.field name="current_password" label="Senha atual" type="password" bag="password" required autocomplete="current-password" />
            @endunless

            <x-form.field
                name="password"
                label="Nova senha"
                type="password"
                bag="password"
                required
                autocomplete="new-password"
                hint="Mínimo de 8 caracteres, com letras e números."
            />
            <x-form.field name="password_confirmation" label="Confirme a nova senha" type="password" bag="password" required autocomplete="new-password" />

            <div>
                <button type="submit" class="button">Salvar senha</button>
            </div>
        </form>
    </section>
</x-layouts.app>
