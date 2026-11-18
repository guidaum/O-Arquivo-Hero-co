{{--
    Mesa de trabalho do Escudo: abas no navegador (a última fica guardada).
    Anotações e referências são desenhadas por public/js/gm-screen/.
--}}
@php
    $deskTabs = [
        'anotacoes' => ['Anotações', 'feather'],
        'referencias' => ['Referências', 'image'],
        'notas' => ['Notas do Mestre', 'scroll'],
        'mapas' => ['Mapas', 'map'],
        'regras' => ['Regras', 'shield'],
    ];
@endphp

<section class="gm-screen__panel gm-screen__desk glass" aria-label="Mesa de trabalho do mestre">
    <nav class="tabs tabs--small screen-tabs" role="tablist" aria-label="Seções do escudo">
        @foreach ($deskTabs as $key => [$label, $tabIcon])
            <button type="button" class="tabs__link" role="tab" id="screen-tab-{{ $key }}" aria-controls="screen-pane-{{ $key }}" aria-selected="{{ $loop->first ? 'true' : 'false' }}" @if ($loop->first) aria-current="page" @endif data-screen-tab="{{ $key }}">
                <x-icon :name="$tabIcon" :size="15" /> {{ $label }}
                @if ($key === 'referencias')
                    <span class="tabs__count" data-reference-count>{{ count($references) }}</span>
                @endif
            </button>
        @endforeach
    </nav>

    {{-- Anotações rápidas da campanha (mesmas do menu de ações no Painel do Mestre). --}}
    <div class="screen-pane" role="tabpanel" id="screen-pane-anotacoes" aria-labelledby="screen-tab-anotacoes" data-screen-pane="anotacoes">
        @include('partials.notes-board')
    </div>

    {{-- Referências visuais: imagens para consultar e mostrar aos jogadores. --}}
    <div class="screen-pane" role="tabpanel" id="screen-pane-referencias" aria-labelledby="screen-tab-referencias" data-screen-pane="referencias" hidden>
        <div class="screen-toolbar">
            <label class="search-field">
                <x-icon name="search" :size="16" />
                <span class="visually-hidden">Buscar referências</span>
                <input class="field__input" type="search" placeholder="Buscar referências..." data-reference-search>
            </label>
            <button type="button" class="button" data-reference-new><x-icon name="plus" :size="16" /> Adicionar imagem</button>
        </div>
        <div class="chips" role="group" aria-label="Filtrar por categoria" data-reference-filter></div>

        <ul class="screen-references" data-reference-list aria-live="polite"></ul>
        <p class="muted screen-pane__empty" data-reference-empty hidden></p>
    </div>

    {{-- Notas longas do mestre (gm_notes), salvas sozinhas enquanto ele escreve. --}}
    <div class="screen-pane" role="tabpanel" id="screen-pane-notas" aria-labelledby="screen-tab-notas" data-screen-pane="notas" hidden>
        <form class="screen-gm-notes" data-gm-notes action="{{ route('gm.sessions.notes', $session) }}">
            <label class="visually-hidden" for="screen-gm-notes">Notas do mestre</label>
            <textarea class="field__input" id="screen-gm-notes" name="gm_notes" maxlength="65000" placeholder="Enredo, segredos da campanha, linha do tempo, próximos passos...">{{ $session->gm_notes }}</textarea>
            <div class="screen-gm-notes__footer">
                <span class="muted" data-gm-notes-status role="status">Salvo automaticamente enquanto você escreve.</span>
                <button type="submit" class="button button--secondary"><x-icon name="save" :size="16" /> Salvar agora</button>
            </div>
        </form>
    </div>

    <div class="screen-pane" role="tabpanel" id="screen-pane-mapas" aria-labelledby="screen-tab-mapas" data-screen-pane="mapas" hidden>
        @include('gm.screen.partials.maps')
    </div>

    <div class="screen-pane" role="tabpanel" id="screen-pane-regras" aria-labelledby="screen-tab-regras" data-screen-pane="regras" hidden>
        @include('gm.screen.partials.rules')
    </div>
</section>
