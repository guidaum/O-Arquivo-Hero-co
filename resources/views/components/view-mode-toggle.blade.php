@props(['mode', 'large' => false])

{{-- Alternador "Modo Mestre / Modo Jogador". $mode é App\Enums\ViewMode. --}}
<div {{ $attributes->class(['segmented', 'segmented--large' => $large]) }} role="group" aria-label="Modo de visão">
    @foreach ([\App\Enums\ViewMode::Gm, \App\Enums\ViewMode::Player] as $option)
        <form method="POST" action="{{ route('view-mode.update') }}">
            @csrf
            @method('PUT')
            <input type="hidden" name="mode" value="{{ $option->value }}">

            <button
                type="submit"
                @class(['segmented__option', 'segmented__option--player' => $option === \App\Enums\ViewMode::Player])
                aria-pressed="{{ $mode === $option ? 'true' : 'false' }}"
                title="{{ $option === \App\Enums\ViewMode::Gm ? 'Ativar Modo Mestre (ferramentas do Mestre)' : 'Ativar Modo Jogador (apenas menus de jogador)' }}"
            >
                <x-icon :name="$option === \App\Enums\ViewMode::Gm ? 'shield' : 'sword'" :size="$large ? 16 : 13" />
                <span class="segmented__text">{{ $large ? 'Modo '.$option->label() : $option->label() }}</span>
            </button>
        </form>
    @endforeach
</div>
