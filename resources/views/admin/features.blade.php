@php
    $roles = [
        ['role' => \App\Enums\UserRole::User, 'label' => 'Jogador', 'sub' => 'Jogadores comuns da mesa', 'icon' => 'sword', 'tone' => 'ember'],
        ['role' => \App\Enums\UserRole::Gm, 'label' => 'Mestre', 'sub' => 'Mestres de sessões de RPG', 'icon' => 'shield', 'tone' => 'arcane'],
        ['role' => \App\Enums\UserRole::Admin, 'label' => 'Administrador', 'sub' => 'Gestores do sistema', 'icon' => 'crown', 'tone' => 'gold'],
    ];
    $total = count($definitions);
@endphp

<x-layouts.app title="Recursos do Menu · Painel Admin">
    @include('admin.partials.header')

    <section class="admin-panel glass">
        <div class="admin-panel__header">
            <div class="admin-panel__title">
                <span class="icon-tile icon-tile--large icon-tile--gold"><x-icon name="sliders" :size="22" /></span>
                <div>
                    <h2>Recursos do Menu por Perfil</h2>
                    <p class="muted">Ative ou desative as seções visíveis na navegação conforme o perfil de usuário.</p>
                </div>
            </div>

            <form method="POST" action="{{ route('admin.features.reset') }}">
                @csrf
                @method('DELETE')
                <input type="hidden" name="perfil" value="{{ $role->value }}">
                <button type="submit" class="button button--secondary">
                    <x-icon name="rotate-ccw" :size="14" />
                    Restaurar Padrões
                </button>
            </form>
        </div>

        <nav class="role-cards" aria-label="Perfis">
            @foreach ($roles as $item)
                @php($active = count(array_filter($permissions[$item['role']->value])))
                <a
                    class="role-card role-card--{{ $item['tone'] }}"
                    href="{{ route('admin.features.edit', ['perfil' => $item['role']->value]) }}"
                    @if ($item['role'] === $role) aria-current="page" @endif
                >
                    <span class="role-card__icon"><x-icon :name="$item['icon']" :size="18" /></span>
                    <span class="role-card__text">
                        <strong>{{ $item['label'] }}</strong>
                        <small>{{ $item['sub'] }}</small>
                    </span>
                    <span class="role-card__count">
                        <strong>{{ $active }}/{{ $total }}</strong>
                        <small>Ativos</small>
                    </span>
                </a>
            @endforeach
        </nav>
    </section>

    <form class="admin-panel glass" method="POST" action="{{ route('admin.features.update') }}">
        @csrf
        @method('PUT')
        <input type="hidden" name="role" value="{{ $role->value }}">

        <div class="admin-panel__header">
            <div>
                <p class="eyebrow">Editando permissões para: <strong class="badge badge--pill badge--{{ $role === \App\Enums\UserRole::User ? 'player' : ($role === \App\Enums\UserRole::Gm ? 'gm' : 'admin') }}">{{ $role->label() }}</strong></p>
                <p class="muted admin-panel__hint">Os itens desligados ficam invisíveis no menu e bloqueados para este perfil.</p>
            </div>

            <div class="admin-panel__actions">
                <button type="button" class="button button--secondary" data-check-all=".feature-item input[type=checkbox]">Ativar Todos</button>
                <button type="submit" class="button button--gold">
                    <x-icon name="save" :size="14" />
                    Salvar Alterações
                </button>
            </div>
        </div>

        <div class="feature-list">
            @foreach ($definitions as $key => $definition)
                <label class="feature-item">
                    <span class="feature-item__text">
                        <span class="feature-item__title">
                            <strong>{{ $definition['label'] }}</strong>
                            <span class="badge">{{ $definition['category'] }}</span>
                            <small>{{ $definition['path'] }}</small>
                        </span>
                        <span class="feature-item__description">{{ $definition['description'] }}</span>
                    </span>

                    <span class="switch">
                        <input type="checkbox" name="features[]" value="{{ $key }}" @checked($permissions[$role->value][$key])>
                        <span class="switch__track"><span class="switch__thumb"></span></span>
                    </span>
                </label>
            @endforeach
        </div>
    </form>
</x-layouts.app>
