{{-- Página provisória dos módulos que ainda estão sendo convertidos. --}}
<x-layouts.app :title="$module">
    <section class="coming-soon glass">
        <span class="icon-tile icon-tile--large icon-tile--gold">
            <x-icon :name="$icon ?? 'hammer'" :size="24" />
        </span>

        <p class="eyebrow">Em construção</p>
        <h1 class="coming-soon__title text-glow-arcane">{{ $module }}</h1>

        @isset($subtitle)
            <p class="page-header__subtitle">{{ $subtitle }}</p>
        @endisset

        <p class="coming-soon__text">{{ $description }}</p>
        <p class="coming-soon__text muted">
            Este módulo está sendo trazido do sistema antigo e estará disponível em breve.
        </p>

        <div class="page-header__actions">
            @foreach ($links ?? [] as $link)
                <a class="button button--pill" href="{{ $link['href'] }}">
                    <x-icon :name="$link['icon']" />
                    {{ $link['label'] }}
                </a>
            @endforeach

            <a class="button button--secondary button--pill" href="{{ route('dashboard') }}">
                <x-icon name="arrow-right" />
                Voltar para Minhas Lendas
            </a>
        </div>
    </section>
</x-layouts.app>
