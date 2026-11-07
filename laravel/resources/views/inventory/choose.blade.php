<x-layouts.app title="Inventário">
    <x-page-header title="Inventário" subtitle="Escolha o personagem" />

    <div class="row-list">
        @forelse ($characters as $character)
            <a class="row-card glass row-card--ember" href="{{ route('inventory.show', $character) }}">
                <div class="row-card__main">
                    <span class="row-card__media">
                        @if ($character->image_url)
                            <img src="{{ $character->image_url }}" alt="" loading="lazy" referrerpolicy="no-referrer">
                        @else
                            <x-icon name="backpack" :size="22" />
                        @endif
                    </span>
                    <div>
                        <h2 class="row-card__title">{{ $character->name }}</h2>
                        <p class="row-card__meta">
                            <span>Nível {{ $character->level }}@if ($character->class) · {{ $character->class }}@endif</span>
                            <span><x-icon name="coins" :size="14" /> {{ number_format($character->money, 0, ',', '.') }} MO</span>
                        </p>
                    </div>
                </div>
                <x-icon name="arrow-right" />
            </a>
        @empty
            <x-empty-state>
                Você ainda não tem personagens.
                @can('use-feature', 'characterCreation')
                    <a href="{{ route('characters.create') }}">Crie sua primeira lenda.</a>
                @endcan
            </x-empty-state>
        @endforelse
    </div>
</x-layouts.app>
