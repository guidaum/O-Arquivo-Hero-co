{{--
    Painel lateral da masmorra (estilo Roll20), recolhível, no mapa normal e
    no Modo TV (o nome do arquivo vem de quando ele só existia no Modo TV).
    Mestre: campanha (jogadores, NPCs e monstros com a vida), ficha, chat e
    anotações da campanha. Jogador: a própria ficha, chat e as anotações do
    personagem. O chat é o mesmo do menu de ações, acoplado aqui
    (public/js/dungeon/tv-drawer.js).
--}}
@php
    $tabs = array_filter([
        'campanha' => $isGm ? ['Campanha', 'users'] : null,
        'ficha' => $tv['sheets']->isNotEmpty() ? ['Ficha', 'scroll-text'] : null,
        'chat' => ['Chat', 'message-square'],
        'notas' => $tv['notesUrl'] ? ['Notas', 'feather'] : null,
    ]);
    $groups = $isGm ? [
        ['Jogadores', 'users', $tv['party'], 'Nenhum personagem de jogador na campanha.'],
        ['NPCs & Monstros', 'crown', $tv['npcs'], 'Nenhum NPC ou monstro ainda.'],
    ] : [];
@endphp

<aside class="tv-drawer" data-tv-drawer data-session="{{ $session->id }}" data-notes="{{ json_encode(['url' => $tv['notesUrl'], 'categories' => App\Http\Controllers\QuickNoteController::CATEGORIES], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) }}" aria-label="Painel da mesa">
    <button type="button" class="tv-drawer__handle glass" data-tv-drawer-toggle aria-expanded="true" aria-controls="tv-drawer-body" title="Recolher o painel">
        <x-icon name="panel-right" :size="18" />
        <span class="tv-drawer__badge" data-tv-chat-badge hidden></span>
    </button>

    <div class="tv-drawer__body glass" id="tv-drawer-body">
        <nav class="tabs tabs--small tv-drawer__tabs" role="tablist" aria-label="Painel da mesa">
            @foreach ($tabs as $key => [$label, $tabIcon])
                <button type="button" class="tabs__link" role="tab" id="tv-tab-{{ $key }}" aria-controls="tv-pane-{{ $key }}" aria-selected="false" data-tv-tab="{{ $key }}">
                    <x-icon :name="$tabIcon" :size="15" /> {{ $label }}
                </button>
            @endforeach
            <button type="button" class="icon-button tv-drawer__exit" data-tv-exit title="Sair do Modo TV"><x-icon name="minimize" :size="16" /><span class="visually-hidden">Sair do Modo TV</span></button>
        </nav>

        @if ($isGm)
            <div class="tv-drawer__pane" role="tabpanel" id="tv-pane-campanha" aria-labelledby="tv-tab-campanha" data-tv-pane="campanha" hidden>
                <div class="tv-drawer__campaign">
                    <div>
                        <strong>{{ $session->name }}</strong>
                        <button type="button" class="badge badge--pill screen-code" data-copy="{{ $session->code }}" title="Copiar o código de convite"><x-icon name="key" :size="12" /> {{ $session->code }}</button>
                    </div>
                    <a class="button button--link" href="{{ route('gm.sessions.screen', $session) }}" target="_blank" rel="noopener" title="Abrir o Escudo do Mestre em outra aba"><x-icon name="shield" :size="14" /> Escudo</a>
                </div>

                <label class="search-field">
                    <x-icon name="search" :size="16" />
                    <span class="visually-hidden">Buscar personagem</span>
                    <input class="field__input" type="search" placeholder="Buscar personagem..." data-tv-search>
                </label>

                @foreach ($groups as [$title, $groupIcon, $characters, $emptyText])
                    <section class="tv-drawer__group">
                        <h3 class="eyebrow"><x-icon :name="$groupIcon" :size="14" /> {{ $title }} <span class="tabs__count">{{ $characters->count() }}</span></h3>

                        @if ($characters->isEmpty())
                            <p class="muted">{{ $emptyText }}</p>
                        @else
                            <ul class="screen-npcs">
                                @foreach ($characters as $character)
                                    @php
                                        $current = (int) ($character->current_pv ?? $character->max_pv);
                                        $percent = (int) $character->max_pv > 0 ? $current / (int) $character->max_pv * 100 : 0;
                                        $state = match (true) {
                                            $current <= 0 => 'down',
                                            $percent <= 25 => 'critical',
                                            $percent <= 50 => 'wounded',
                                            default => 'healthy',
                                        };
                                        $subtitle = $character->is_npc
                                            ? ($character->class ?: ($character->is_monster ? 'Monstro' : 'NPC'))
                                            : ($character->user?->name ?? 'Jogador');
                                    @endphp
                                    <li class="screen-npc" data-health-card data-state="{{ $state }}" data-tv-character data-search="{{ mb_strtolower($character->name.' '.$subtitle) }}">
                                        <details>
                                            <summary>
                                                @include('gm.screen.partials.portrait', ['character' => $character])
                                                <span class="screen-npc__name">
                                                    <strong>{{ $character->name }}</strong>
                                                    <small class="muted">{{ $subtitle }} · Nv {{ $character->level }}</small>
                                                </span>
                                                <span class="screen-npc__pv" title="Pontos de vida"><x-icon name="heart" :size="12" /> <span data-health-current>{{ $current }}</span></span>
                                            </summary>

                                            <div class="screen-npc__body">
                                                @include('gm.screen.partials.health', ['character' => $character])
                                                <button type="button" class="button button--secondary button--block" data-tv-sheet-open="{{ $character->id }}">
                                                    <x-icon name="scroll-text" :size="14" /> Ver ficha
                                                </button>
                                            </div>
                                        </details>
                                    </li>
                                @endforeach
                            </ul>
                        @endif
                    </section>
                @endforeach
                <p class="muted" data-tv-search-empty hidden>Nenhum personagem com esse nome.</p>
            </div>
        @endif

        @if ($tv['sheets']->isNotEmpty())
            <div class="tv-drawer__pane tv-drawer__pane--sheet" role="tabpanel" id="tv-pane-ficha" aria-labelledby="tv-tab-ficha" data-tv-pane="ficha" hidden>
                <div class="tv-drawer__sheet-bar">
                    @if ($tv['sheets']->count() > 1)
                        <select class="select" data-tv-sheet-select aria-label="Personagem">
                            @foreach ($tv['sheets'] as $character)
                                <option value="{{ $character->id }}" data-url="{{ route('characters.show', $character) }}">{{ $character->name }}{{ $isGm && $character->is_npc ? ' (NPC)' : '' }}</option>
                            @endforeach
                        </select>
                    @else
                        @php($only = $tv['sheets']->first())
                        <strong>{{ $only->name }}</strong>
                        <select class="visually-hidden" data-tv-sheet-select aria-hidden="true" tabindex="-1">
                            <option value="{{ $only->id }}" data-url="{{ route('characters.show', $only) }}">{{ $only->name }}</option>
                        </select>
                    @endif
                    <a class="button button--link" data-tv-sheet-link href="#" target="_blank" rel="noopener" title="Abrir a ficha em outra aba"><x-icon name="link" :size="14" /><span class="visually-hidden">Abrir em nova aba</span></a>
                </div>
                {{-- A ficha só carrega quando a aba abre (e volta a carregar ao trocar de personagem). --}}
                <iframe class="tv-drawer__frame" data-tv-sheet-frame title="Ficha do personagem" src="about:blank"></iframe>
            </div>
        @endif

        <div class="tv-drawer__pane tv-drawer__pane--chat" role="tabpanel" id="tv-pane-chat" aria-labelledby="tv-tab-chat" data-tv-pane="chat" hidden>
            <div class="tv-drawer__chat" data-tv-chat-slot></div>
        </div>

        @if ($tv['notesUrl'])
            <div class="tv-drawer__pane" role="tabpanel" id="tv-pane-notas" aria-labelledby="tv-tab-notas" data-tv-pane="notas" data-screen-pane="anotacoes" hidden>
                <p class="eyebrow">{{ $tv['notesLabel'] }}</p>
                @include('partials.notes-board')
            </div>
        @endif
    </div>
</aside>
