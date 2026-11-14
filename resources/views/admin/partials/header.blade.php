{{-- Cabeçalho do Painel Admin com as abas (cada aba é uma rota). --}}
@push('styles')
    <link rel="stylesheet" href="@asset('css/admin.css')">
@endpush

<header class="admin-header">
    <div class="admin-header__brand">
        <span class="icon-tile icon-tile--large icon-tile--gold"><x-icon name="shield" :size="24" /></span>
        <div>
            <h1 class="admin-header__title">Painel do Administrador</h1>
            <p class="eyebrow">Gestão centralizada do sistema</p>
        </div>
    </div>

    <nav class="tabs tabs--gold" aria-label="Seções do Painel Admin">
        @foreach ([
            ['admin.index', 'Dashboard', 'bar-chart'],
            ['admin.features.edit', 'Recursos do Menu', 'sliders'],
            ['admin.users.index', 'Usuários', 'users'],
            ['admin.characters.index', 'Personagens', 'sword'],
            ['admin.sessions.index', 'Sessões', 'scroll-text'],
            ['admin.suggestions.index', 'Sugestões', 'lightbulb'],
        ] as [$route, $label, $icon])
            <a class="tabs__link" href="{{ route($route) }}" @if (request()->routeIs($route)) aria-current="page" @endif>
                <x-icon :name="$icon" :size="18" />
                {{ $label }}
                {{-- Pendências: propostas das campanhas + sugestões dos jogadores. --}}
                @if ($route === 'admin.suggestions.index' && ($pendingSuggestions = \App\Support\CampaignLibrary::proposals()->count() + \App\Models\Suggestion::query()->forAdmin()->where('status', \App\Enums\SuggestionStatus::Pending)->count()) > 0)
                    <span class="tabs__count">{{ $pendingSuggestions }}</span>
                @endif
            </a>
        @endforeach
    </nav>
</header>

@if ($errors->any())
    <div class="alert alert--error" role="alert">{{ $errors->first() }}</div>
@endif
