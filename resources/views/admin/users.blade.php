<x-layouts.app title="Usuários · Painel Admin">
    @include('admin.partials.header')

    <x-search-bar :search="$search" placeholder="Buscar usuários por nome ou e-mail...">
        <label class="inline-form">
            <x-icon name="filter" :size="18" class="muted" />
            <span class="visually-hidden">Papel</span>
            <select class="select" name="papel" data-autosubmit>
                <option value="">Todos os papéis</option>
                @foreach (\App\Enums\UserRole::cases() as $option)
                    <option value="{{ $option->value }}" @selected($role === $option)>{{ $option->label() }}</option>
                @endforeach
            </select>
        </label>
    </x-search-bar>

    <div class="row-list">
        @forelse ($users as $user)
            <article class="row-card glass">
                <div class="row-card__main">
                    <span class="row-card__media">
                        @if ($user->photo_url)
                            <img src="{{ $user->photo_url }}" alt="" loading="lazy" referrerpolicy="no-referrer">
                        @else
                            <x-icon name="users" :size="24" />
                        @endif
                    </span>

                    <div>
                        <h3 class="row-card__title">
                            {{ $user->name }}
                            <x-role-badge :role="$user->role" pill />
                            @if ($user->needsPasswordSetup())
                                <span class="badge badge--pill" title="Ainda não definiu senha no novo sistema">Sem senha</span>
                            @endif
                        </h3>
                        <p class="row-card__meta">
                            <span><x-icon name="mail" :size="14" /> {{ $user->email }}</span>
                            <span><x-icon name="calendar" :size="14" /> Desde {{ $user->created_at?->format('d/m/Y') }}</span>
                            <span><x-icon name="clock" :size="14" /> {{ $user->last_active_at ? 'Visto '.$user->last_active_at->diffForHumans() : 'Nunca acessou' }}</span>
                        </p>
                    </div>
                </div>

                <div class="row-card__actions">
                    @if ($user->is(auth()->user()))
                        <span class="muted">Sua conta</span>
                    @else
                        <form class="inline-form" method="POST" action="{{ route('admin.users.role', $user) }}">
                            @csrf
                            @method('PUT')
                            <label class="visually-hidden" for="role-{{ $user->id }}">Papel de {{ $user->name }}</label>
                            <select class="select" id="role-{{ $user->id }}" name="role" data-autosubmit>
                                @foreach (\App\Enums\UserRole::cases() as $option)
                                    <option value="{{ $option->value }}" @selected($user->role === $option)>{{ $option->label() }}</option>
                                @endforeach
                            </select>
                            <noscript><button type="submit" class="button button--secondary">Salvar</button></noscript>
                        </form>

                        <button
                            type="button"
                            class="icon-button icon-button--danger"
                            title="Excluir permanentemente"
                            aria-label="Excluir {{ $user->name }}"
                            data-modal-open="confirm-delete"
                            data-modal-action="{{ route('admin.users.destroy', $user) }}"
                            data-modal-text-name="{{ $user->name }} ({{ $user->email }})"
                        >
                            <x-icon name="trash" :size="18" />
                        </button>
                    @endif
                </div>
            </article>
        @empty
            <x-empty-state>Nenhum usuário encontrado com os filtros atuais.</x-empty-state>
        @endforelse
    </div>

    {{ $users->links() }}

    <x-admin.delete-modal type="Usuário" warning="Personagens, campanhas e registros dele continuam no sistema, sem dono." />
</x-layouts.app>
