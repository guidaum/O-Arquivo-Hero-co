{{--
    Painel do Mestre de uma campanha (GMDashboard.tsx). Abas por query string:
    mesa (vida, progressão e NPCs), bestiário, encontros, anotações e
    configurações. Ações rápidas (vida, envio para a masmorra, bestiário e
    encontros) usam fetch em public/js/gm/index.js.
--}}
@php
    $tabUrl = static fn (string $key): string => route('gm.sessions.show', [$session, 'aba' => $key]);
    $config = [
        'mapsUrl' => route('map-manager.index', ['campanha' => $session->id, 'tipo' => 'dungeon']),
        'encounterUrl' => route('gm.sessions.encounter', $session),
        'bestiaryUrl' => route('gm.sessions.bestiary.spawn', $session),
    ];
@endphp

<x-layouts.app :title="$session->name">
    @push('styles')
        <link rel="stylesheet" href="@asset('css/gm-session.css')">
    @endpush

    <x-page-header :title="$session->name" subtitle="Painel do Mestre" :back="route('dashboard')" back-label="Minhas Campanhas">
        <x-slot:badges>
            <span class="badge badge--pill badge--gm"><x-icon name="shield" :size="12" /> Mestre da campanha</span>
            @unless ($session->active)
                <span class="badge badge--pill">Inativa</span>
            @endunless
        </x-slot:badges>

        <x-slot:actions>
            <a class="button button--secondary button--pill" href="{{ route('gm.sessions.rules.edit', $session) }}" @if ($libraryPending > 0) title="{{ $libraryPending }} sugestão(ões) das Configurações Base" @endif>
                <x-icon name="sliders" /> Regras & Biblioteca
                @if ($libraryPending > 0) <span class="tabs__count">{{ $libraryPending }}</span> @endif
            </a>
            @can('use-feature', 'journal')
                <a class="button button--secondary button--pill" href="{{ route('journal.index', ['visao' => 'campanha', 'campanha' => $session->id]) }}">
                    <x-icon name="book-open" /> Diário
                </a>
            @endcan
            <a class="button button--secondary button--pill" href="{{ route('map-manager.index', ['campanha' => $session->id]) }}">
                <x-icon name="map" /> Mapas
            </a>
            <a class="button button--secondary button--pill" href="{{ route('catalog.talents.index') }}">
                <x-icon name="library" /> Catálogos
            </a>
        </x-slot:actions>
    </x-page-header>

    <nav class="tabs gm-tabs" aria-label="Seções do painel">
        @foreach (App\Http\Controllers\GmSessionController::TABS as $key => [$label, $tabIcon])
            <a class="tabs__link" href="{{ $tabUrl($key) }}" @if ($tab === $key) aria-current="page" @endif>
                <x-icon :name="$tabIcon" :size="16" /> {{ $label }}
                @if ($key === 'mesa')
                    <span class="tabs__count">{{ $session->characters_count }}</span>
                @endif
            </a>
        @endforeach

        {{-- Configurações da campanha (regras e bibliotecas herdadas da base) ficam em páginas próprias. --}}
        <a class="tabs__link" href="{{ route('gm.sessions.rules.edit', $session) }}">
            <x-icon name="library" :size="16" /> Regras & Biblioteca
            @if ($libraryPending > 0) <span class="tabs__count" title="Sugestões das Configurações Base">{{ $libraryPending }}</span> @endif
        </a>
    </nav>

    <div class="gm-dashboard" data-gm-dashboard data-config="{{ json_encode($config, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) }}">
        @include('gm.sessions.tabs.'.$tab)
    </div>

    <p class="gm-toast" data-gm-toast role="status" aria-live="polite" hidden></p>

    <x-action-menu :session="$session" notes="campaign" />

    @push('scripts')
        <script type="module" src="@asset('js/gm/index.js')"></script>
    @endpush
</x-layouts.app>
