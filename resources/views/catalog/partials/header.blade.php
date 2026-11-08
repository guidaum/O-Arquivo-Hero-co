{{-- Cabeçalho das bibliotecas do Mestre com as abas (cada aba é uma rota). --}}
@push('styles')
    <link rel="stylesheet" href="@asset('css/catalog.css')">
@endpush

@php
    $pendingSuggestions = \App\Models\Suggestion::query()->where('status', \App\Enums\SuggestionStatus::Pending)->count();
    $tabs = [
        ['catalog.talents.*', 'catalog.talents.index', 'Talentos', 'activity'],
        ['catalog.skills.*', 'catalog.skills.index', 'Perícias', 'sword'],
        ['catalog.powers.*', 'catalog.powers.index', 'Poderes', 'zap'],
        ['catalog.traits.*', 'catalog.traits.index', 'Vantagens & Defeitos', 'sparkles'],
        ['catalog.items.*', 'catalog.items.index', 'Itens', 'backpack'],
        ['catalog.suggestions.*', 'catalog.suggestions.index', 'Sugestões', 'lightbulb'],
    ];
@endphp

<header class="catalog-header">
    <div class="catalog-header__brand">
        <span class="icon-tile icon-tile--large"><x-icon name="library" :size="24" /></span>
        <div>
            <h1 class="catalog-header__title text-glow-arcane">{{ $title }}</h1>
            <p class="eyebrow">{{ $subtitle ?? 'Bibliotecas globais do Mestre' }}</p>
        </div>
    </div>

    <nav class="tabs" aria-label="Bibliotecas">
        @foreach ($tabs as [$pattern, $route, $label, $icon])
            <a class="tabs__link" href="{{ route($route) }}" @if (request()->routeIs($pattern)) aria-current="page" @endif>
                <x-icon :name="$icon" :size="18" />
                {{ $label }}
                @if ($route === 'catalog.suggestions.index' && $pendingSuggestions > 0)
                    <span class="tabs__count">{{ $pendingSuggestions }}</span>
                @endif
            </a>
        @endforeach

        @can('access-admin')
            <a class="tabs__link tabs__link--gold" href="{{ route('catalog.rules.edit') }}" @if (request()->routeIs('catalog.rules.*')) aria-current="page" @endif>
                <x-icon name="sliders" :size="18" />
                Configurações Base
            </a>
        @endcan
    </nav>
</header>

@if ($errors->has('suggestion'))
    <div class="alert alert--error" role="alert">{{ $errors->first('suggestion') }}</div>
@endif
