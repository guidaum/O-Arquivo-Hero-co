{{--
    Cabeçalho das configurações da campanha (Painel do Mestre): Regras e as
    bibliotecas herdadas da base. Cada aba mostra quantas sugestões da base
    esperam o mestre. Parâmetros: session e current ('regras' ou o tipo).
--}}
@push('styles')
    <link rel="stylesheet" href="@asset('css/catalog.css')">
@endpush

@php
    $library = \App\Support\CampaignLibrary::for($session);
    $counts = $pendingCounts ?? $library->pendingCounts();
    $rulesCount = $rulesPending ?? (($rules = $session->ruleSet) ? count($rules->pendingBaseChanges(\App\Models\RuleSet::query()->global()->first())) : 0);
    // Itens do inventário sugeridos pelos jogadores para a loja da campanha.
    $playerItemCount = \App\Models\Suggestion::query()
        ->where('type', \App\Enums\SuggestionType::Item)
        ->where('game_session_id', $session->id)
        ->where('status', \App\Enums\SuggestionStatus::Pending)
        ->count();
@endphp

<x-page-header :title="$session->name" subtitle="Configurações da Campanha" :back="route('gm.sessions.show', $session)" back-label="Voltar ao Painel do Mestre">
    <x-slot:badges>
        <span class="badge badge--pill badge--gm"><x-icon name="shield" :size="12" /> Herda as Configurações Base</span>
    </x-slot:badges>
</x-page-header>

<p class="library-intro muted">
    A campanha usa as Configurações Base. Tudo o que você alterar aqui vale só para esta campanha;
    quando a base mudar, a mudança aparece como sugestão para você adotar ou não. O que você criar ou
    alterar também chega ao administrador como sugestão para a base.
</p>

@if ($errors->has('library'))
    <div class="alert alert--error" role="alert">{{ $errors->first('library') }}</div>
@endif

<nav class="tabs library-tabs" aria-label="Configurações da campanha">
    <a class="tabs__link" href="{{ route('gm.sessions.rules.edit', $session) }}" @if ($current === 'regras') aria-current="page" @endif>
        <x-icon name="sliders" :size="18" /> Regras
        @if ($rulesCount > 0) <span class="tabs__count" title="Sugestões da base">{{ $rulesCount }}</span> @endif
    </a>

    @foreach (\App\Support\CampaignLibrary::TYPES as $key => $definition)
        <a class="tabs__link" href="{{ route('gm.sessions.library.index', [$session, 'tipo' => $key]) }}" @if ($current === $key) aria-current="page" @endif>
            <x-icon :name="$definition['icon']" :size="18" /> {{ $definition['label'] }}
            @if (($counts[$key] ?? 0) > 0) <span class="tabs__count" title="Sugestões da base">{{ $counts[$key] }}</span> @endif
            @if ($key === 'itens' && $playerItemCount > 0) <span class="tabs__count" title="Sugestões dos jogadores">{{ $playerItemCount }}</span> @endif
        </a>
    @endforeach
</nav>
