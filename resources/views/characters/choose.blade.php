<x-layouts.app title="Ficha Geral">
    <x-page-header title="Ficha Geral" subtitle="Escolha o personagem" />

    <div class="row-list">
        @forelse ($characters as $character)
            <a class="row-card glass row-card--arcane" href="{{ route('characters.show', $character) }}">
                <div class="row-card__main">
                    <span class="row-card__media">
                        @if ($character->image_url)
                            <img src="{{ $character->image_url }}" alt="" loading="lazy" referrerpolicy="no-referrer">
                        @else
                            <x-icon name="scroll-text" :size="22" />
                        @endif
                    </span>
                    <div>
                        <h2 class="row-card__title">{{ $character->name }}</h2>
                        <p class="row-card__meta"><span>Nível {{ $character->level }}@if ($character->class) · {{ $character->class }}@endif</span></p>
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
