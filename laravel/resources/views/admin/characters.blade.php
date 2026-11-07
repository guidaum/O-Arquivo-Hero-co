<x-layouts.app title="Personagens · Painel Admin">
    @include('admin.partials.header')

    <x-search-bar :search="$search" placeholder="Buscar personagens por nome ou classe..." />

    <div class="row-list">
        @forelse ($characters as $character)
            <article class="row-card row-card--ember glass">
                <div class="row-card__main">
                    <span class="row-card__media">
                        @if ($character->image_url)
                            <img src="{{ $character->image_url }}" alt="" loading="lazy" referrerpolicy="no-referrer">
                        @else
                            <x-icon name="sword" :size="24" />
                        @endif
                    </span>

                    <div>
                        <h3 class="row-card__title">
                            {{ $character->name }}
                            @if ($character->is_npc)
                                <span class="badge badge--pill badge--gm">NPC</span>
                            @endif
                        </h3>
                        <p class="row-card__meta">
                            <span><x-icon name="scroll" :size="14" /> Nível {{ $character->level }}@if ($character->class) · {{ $character->class }}@endif</span>
                            <span><x-icon name="user" :size="14" /> {{ $character->user?->name ?? 'Sem dono' }}</span>
                            <span><x-icon name="history" :size="14" /> {{ $character->gameSession?->name ?? 'Sem campanha' }}</span>
                        </p>
                    </div>
                </div>

                <div class="row-card__actions">
                    <button
                        type="button"
                        class="icon-button icon-button--danger"
                        title="Excluir permanentemente"
                        aria-label="Excluir {{ $character->name }}"
                        data-modal-open="confirm-delete"
                        data-modal-action="{{ route('admin.characters.destroy', $character) }}"
                        data-modal-text-name="{{ $character->name }}"
                    >
                        <x-icon name="trash" :size="18" />
                    </button>
                </div>
            </article>
        @empty
            <x-empty-state>Nenhum personagem encontrado com os filtros atuais.</x-empty-state>
        @endforelse
    </div>

    {{ $characters->links() }}

    <x-admin.delete-modal type="Personagem" warning="Perícias, poderes, traços, itens e anotações do personagem também serão apagados." />
</x-layouts.app>
