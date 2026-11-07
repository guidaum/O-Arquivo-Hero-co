<x-layouts.app title="Sessões · Painel Admin">
    @include('admin.partials.header')

    <x-search-bar :search="$search" placeholder="Buscar campanhas por nome ou código..." />

    <div class="row-list">
        @forelse ($sessions as $session)
            <article class="row-card row-card--arcane glass">
                <div class="row-card__main">
                    <span class="row-card__media">
                        @if ($session->image_url)
                            <img src="{{ $session->image_url }}" alt="" loading="lazy" referrerpolicy="no-referrer">
                        @else
                            <x-icon name="scroll-text" :size="24" />
                        @endif
                    </span>

                    <div>
                        <h3 class="row-card__title">
                            {{ $session->name }}
                            @unless ($session->active)
                                <span class="badge badge--pill">Encerrada</span>
                            @endunless
                        </h3>
                        <p class="row-card__meta">
                            <span><x-icon name="shield" :size="14" /> Código {{ $session->code }}</span>
                            <span><x-icon name="crown" :size="14" /> {{ $session->gm?->name ?? 'Sem mestre' }}</span>
                            <span><x-icon name="users" :size="14" /> {{ $session->players_count }} {{ $session->players_count === 1 ? 'jogador' : 'jogadores' }}</span>
                            <span><x-icon name="sword" :size="14" /> {{ $session->characters_count }} {{ $session->characters_count === 1 ? 'personagem' : 'personagens' }}</span>
                        </p>
                    </div>
                </div>

                <div class="row-card__actions">
                    <button
                        type="button"
                        class="icon-button icon-button--danger"
                        title="Excluir permanentemente"
                        aria-label="Excluir {{ $session->name }}"
                        data-modal-open="confirm-delete"
                        data-modal-action="{{ route('admin.sessions.destroy', $session) }}"
                        data-modal-text-name="{{ $session->name }} ({{ $session->code }})"
                    >
                        <x-icon name="trash" :size="18" />
                    </button>
                </div>
            </article>
        @empty
            <x-empty-state>Nenhuma campanha encontrada com os filtros atuais.</x-empty-state>
        @endforelse
    </div>

    {{ $sessions->links() }}

    <x-admin.delete-modal type="Campanha" warning="Chat, mapas, tokens e regras próprias da campanha também serão apagados. Os personagens ficam sem campanha." />
</x-layouts.app>
