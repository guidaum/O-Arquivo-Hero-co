{{-- Gerenciador de Mapas no modo Jogador (como no sistema antigo): só mestres gerenciam mapas. --}}
<x-layouts.app title="Gerenciador de Mapas">
    <section class="coming-soon glass">
        <span class="icon-tile icon-tile--large icon-tile--ember"><x-icon name="sword" :size="24" /></span>
        <p class="eyebrow">Modo Jogador ativo</p>
        <h1 class="coming-soon__title text-glow-arcane">Acesso Exclusivo para Mestres</h1>
        <p class="coming-soon__text">
            Você está no Modo Jogador. Os mapas da sua campanha ficam disponíveis no Mapa do Mundo e na ficha do seu personagem.
        </p>

        <div class="page-header__actions">
            @can('use-feature', 'worldMap')
                <a class="button button--pill" href="{{ route('world-map.index') }}"><x-icon name="compass" /> Ver o Mapa do Mundo</a>
            @endcan
            @if ($canBeGm)
                <form method="POST" action="{{ route('view-mode.update') }}">
                    @csrf
                    @method('PUT')
                    <input type="hidden" name="mode" value="gm">
                    <button type="submit" class="button button--secondary button--pill"><x-icon name="shield" /> Alternar para Modo Mestre</button>
                </form>
            @endif
        </div>
    </section>
</x-layouts.app>
