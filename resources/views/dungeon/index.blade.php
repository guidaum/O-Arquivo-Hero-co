{{--
    Battlemap da masmorra (DungeonMap.tsx). A estrutura vem do servidor;
    tokens, névoa, áreas, marcadores, desenhos, sinais e combate chegam por
    polling (public/js/dungeon/index.js).
--}}
<x-layouts.app title="Dungeons & Tokens" full>
    @push('styles')
        <link rel="stylesheet" href="{{ asset('css/world-map.css') }}">
        <link rel="stylesheet" href="{{ asset('css/dungeon.css') }}">
    @endpush

    @if ($session === null)
        <div class="world-map-empty">
            <x-empty-state>Você ainda não participa de nenhuma campanha. Entre em uma com o código do mestre no painel inicial.</x-empty-state>
        </div>
    @elseif ($map === null)
        <div class="world-map-empty">
            <section class="world-map-empty__card glass">
                <span class="icon-tile icon-tile--large"><x-icon name="skull" :size="28" /></span>
                <h1>Nenhuma masmorra ativa</h1>
                <p class="muted">O Mestre da campanha "{{ $session->name }}" ainda não liberou nenhum battlemap.</p>
                @if ($sessions->count() > 1)
                    <form method="GET" action="{{ route('dungeon.index') }}">
                        <select class="select" name="campanha" data-autosubmit aria-label="Campanha">
                            @foreach ($sessions as $option)
                                <option value="{{ $option->id }}" @selected($option->id === $session->id)>{{ $option->name }}</option>
                            @endforeach
                        </select>
                    </form>
                @endif
            </section>
        </div>
    @else
        <div class="world-map dungeon" data-dungeon @if ($isGm) data-gm @endif data-config="{{ json_encode($config, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) }}">
            <header class="world-map__bar glass">
                <details class="dropdown world-map__selector" data-dropdown>
                    <summary aria-haspopup="menu">
                        <span class="icon-tile icon-tile--ember"><x-icon name="skull" :size="18" /></span>
                        <span class="world-map__identity">
                            <strong>{{ $map->name }}</strong>
                            <small>{{ $map->gridCols() }}×{{ $map->gridRows() }} · {{ $map->theme ?: 'Masmorra' }}</small>
                        </span>
                        <x-icon name="chevron-down" :size="16" />
                    </summary>
                    <div class="dropdown__menu world-map__maps">
                        <div class="dropdown__header"><p class="eyebrow">Masmorras da campanha</p></div>
                        @foreach ($maps as $option)
                            <div @class(['world-map__map-option', 'is-current' => $option->id === $map->id])>
                                <a href="{{ route('dungeon.index', ['campanha' => $session->id, 'mapa' => $option->id]) }}">
                                    <img src="{{ $option->thumbnailUrl($isGm) }}" alt="" loading="lazy">
                                    <span><strong>{{ $option->name }}</strong><small>{{ $option->subtitle }}</small></span>
                                </a>
                                @if ($isGm)
                                    <label class="switch" title="Visível para os jogadores">
                                        <input type="checkbox" data-map-active="{{ route('world-map.active', [$session, $option]) }}" @checked($option->active_in_session)>
                                        <span class="switch__track"><span class="switch__thumb"></span></span>
                                    </label>
                                @endif
                            </div>
                        @endforeach
                    </div>
                </details>

                <form method="GET" action="{{ route('dungeon.index') }}" class="world-map__session">
                    <select class="select" name="campanha" data-autosubmit aria-label="Campanha">
                        @foreach ($sessions as $option)
                            <option value="{{ $option->id }}" @selected($option->id === $session->id)>{{ $option->name }}</option>
                        @endforeach
                    </select>
                    @if ($isGm)
                        <span class="badge badge--pill badge--gm"><x-icon name="shield" :size="12" /> Mestre</span>
                    @endif
                </form>

                <div class="world-map__tools">
                    @if ($config['myCharacters']->isNotEmpty())
                        <button type="button" class="tool-toggle tool-toggle--accent" data-join hidden><x-icon name="user-plus" :size="18" /><span>Entrar no mapa</span></button>
                    @endif
                    @if ($isGm)
                        <label class="dungeon-weather" title="Clima visual do mapa (todos veem)">
                            <x-icon name="sparkles" :size="16" />
                            <span class="visually-hidden">Clima</span>
                            <select class="select" data-weather>
                                @foreach (App\Support\Sounds::WEATHER as $key => $label)
                                    <option value="{{ $key }}">{{ $label }}</option>
                                @endforeach
                            </select>
                        </label>
                        <button type="button" class="tool-toggle" data-modal-open="spawn-token"><x-icon name="plus" :size="18" /><span>Criaturas</span></button>
                    @endif
                    <button type="button" class="tool-toggle" data-tv title="Modo TV: só o mapa, em tela cheia"><x-icon name="maximize" :size="18" /><span>Modo TV</span></button>
                    @can('use-feature', 'worldMap')
                        <a class="tool-toggle" href="{{ route('world-map.index', ['campanha' => $session->id]) }}" title="Voltar ao Mapa do Mundo"><x-icon name="compass" :size="18" /></a>
                    @endcan
                </div>
            </header>

            <div class="world-map__body">
                <div class="world-map__viewport" data-viewport>
                    <p class="world-map__banner" data-banner hidden></p>
                    <canvas class="dungeon__weather" data-weather-layer aria-hidden="true" hidden></canvas>

                    {{-- Ferramentas --}}
                    <div class="dungeon-tools glass" role="toolbar" aria-label="Ferramentas do battlemap">
                        @foreach ([
                            ['move', 'crosshair', 'Mover tokens (arraste; setas do teclado movem o selecionado)'],
                            ['ruler', 'activity', 'Régua: arraste para medir'],
                            ['ping', 'radio', 'Sinal: clique para avisar a todos (ou Shift + clique)'],
                            ['aoe', 'flame', 'Área de efeito: clique para posicionar'],
                            ['marker', 'map-pin', 'Marcador tático: clique para posicionar'],
                            ['draw', 'pencil', 'Desenhar'],
                        ] as [$mode, $icon, $label])
                            <button type="button" class="icon-button" data-mode="{{ $mode }}" aria-pressed="{{ $mode === 'move' ? 'true' : 'false' }}" title="{{ $label }}"><x-icon :name="$icon" :size="18" /></button>
                        @endforeach
                        @if ($isGm)
                            <button type="button" class="icon-button" data-mode="fog" aria-pressed="false" title="Névoa de guerra (pincel do mestre)"><x-icon name="eye-off" :size="18" /></button>
                        @endif
                    </div>

                    {{-- Opções da ferramenta ativa --}}
                    <div class="dungeon-options glass" data-options="aoe" hidden>
                        <select class="select" data-aoe-preset aria-label="Molde">
                            @foreach ([['Bola de Fogo', 'circle', 20, '#ef4444'], ['Sopro de Dragão', 'cone', 30, '#f97316'], ['Relâmpago', 'line', 60, '#38bdf8'], ['Nuvem Tóxica', 'cube', 20, '#10b981'], ['Espíritos Guardiões', 'circle', 15, '#eab308'], ['Cone de Frio', 'cone', 60, '#06b6d4']] as [$name, $type, $feet, $color])
                                <option value="{{ $type }}|{{ $feet }}|{{ $color }}|{{ $name }}">{{ $name }} ({{ App\Http\Controllers\DungeonAnnotationController::AOE_TYPES[$type] }} {{ $feet }} pés)</option>
                            @endforeach
                        </select>
                        <label class="dungeon-options__field">Tamanho <input class="field__input" type="number" min="5" max="500" step="5" value="20" data-aoe-feet> pés</label>
                        <label class="dungeon-options__field">Giro <input class="field__input" type="number" min="0" max="359" step="15" value="0" data-aoe-rotation>°</label>
                        @if ($isGm)
                            <button type="button" class="button button--secondary" data-aoe-clear><x-icon name="trash" :size="14" /> Limpar áreas</button>
                        @endif
                    </div>

                    @if ($isGm)
                        <div class="dungeon-options glass" data-options="fog" hidden>
                            <label class="checkbox"><input type="checkbox" data-fog-enabled> <span>Névoa ativa</span></label>
                            <div class="segmented" role="group" aria-label="Pincel">
                                <button type="button" class="segmented__option" data-brush-mode="reveal" aria-pressed="true">Revelar</button>
                                <button type="button" class="segmented__option" data-brush-mode="hide" aria-pressed="false">Ocultar</button>
                            </div>
                            <div class="segmented" role="group" aria-label="Tamanho do pincel">
                                <button type="button" class="segmented__option" data-brush-size="1" aria-pressed="false">1</button>
                                <button type="button" class="segmented__option" data-brush-size="2" aria-pressed="true">3×3</button>
                                <button type="button" class="segmented__option" data-brush-size="3" aria-pressed="false">5×5</button>
                            </div>
                            <button type="button" class="chip" data-fog-action="reveal-all">Revelar tudo</button>
                            <button type="button" class="chip" data-fog-action="hide-all">Ocultar tudo</button>
                            <button type="button" class="chip" data-fog-action="players">Ao redor dos jogadores</button>
                        </div>
                    @endif

                    <div class="world-map__stage dungeon__stage" data-stage>
                        <img class="world-map__image" src="{{ $map->image_url }}" alt="{{ $map->name }}" draggable="false" data-map-image>
                        <div class="dungeon__grid" data-grid aria-hidden="true"></div>
                        <svg class="dungeon__aoes" data-aoes aria-hidden="true"></svg>
                        <svg class="world-map__drawings" data-drawings viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"></svg>
                        <div class="dungeon__markers" data-markers></div>
                        <div class="dungeon__tokens" data-tokens></div>
                        <canvas class="dungeon__fog" data-fog aria-hidden="true"></canvas>
                        <svg class="dungeon__ruler" data-ruler aria-hidden="true"></svg>
                        <div class="world-map__pings" data-pings></div>
                    </div>

                    <div class="draw-toolbar glass" data-draw-toolbar hidden>
                        <div class="draw-toolbar__group">
                            <button type="button" class="icon-button" data-draw-tool="pen" aria-pressed="true" title="Caneta"><x-icon name="pencil" :size="16" /></button>
                            <button type="button" class="icon-button" data-draw-tool="polygon" aria-pressed="false" title="Polígono"><x-icon name="pentagon" :size="16" /></button>
                            <button type="button" class="icon-button" data-draw-tool="eraser" aria-pressed="false" title="Borracha"><x-icon name="eraser" :size="16" /></button>
                        </div>
                        <div class="draw-toolbar__group" data-draw-colors></div>
                        <div class="draw-toolbar__group" data-draw-sizes></div>
                        <div class="draw-toolbar__group">
                            <button type="button" class="icon-button" data-draw-undo title="Desfazer"><x-icon name="undo" :size="16" /></button>
                            <button type="button" class="icon-button" data-draw-redo title="Refazer"><x-icon name="redo" :size="16" /></button>
                            <button type="button" class="icon-button" data-draw-clear="mine" title="Limpar meus desenhos"><x-icon name="trash" :size="16" /></button>
                            @if ($isGm)
                                <button type="button" class="icon-button icon-button--danger" data-draw-clear="all" title="Limpar todos"><x-icon name="trash" :size="16" /><small>Todos</small></button>
                            @endif
                        </div>
                    </div>

                    <div class="world-map__controls glass">
                        <button type="button" class="icon-button" data-zoom="in" title="Aproximar"><x-icon name="zoom-in" :size="18" /></button>
                        <span class="world-map__zoom" data-zoom-label>100%</span>
                        <button type="button" class="icon-button" data-zoom="out" title="Afastar"><x-icon name="zoom-out" :size="18" /></button>
                        <button type="button" class="icon-button" data-zoom="reset" title="Centralizar"><x-icon name="locate" :size="18" /></button>
                        <button type="button" class="icon-button" data-grid-toggle aria-pressed="true" title="Grade"><x-icon name="grid" :size="18" /></button>
                    </div>

                    <p class="world-map__coords glass" data-coords>Passe o cursor sobre o mapa</p>
                </div>

                <aside class="world-map__sidebar glass dungeon__sidebar" data-sidebar>
                    <section class="dungeon-selected" data-selected hidden></section>

                    <nav class="tabs tabs--small dungeon__tabs" aria-label="Painel">
                        <button type="button" class="tabs__link" data-tab="tokens" aria-current="page">Tokens</button>
                        <button type="button" class="tabs__link" data-tab="combat">Combate</button>
                    </nav>
                    <ul class="pin-list" data-panel="tokens" data-token-list></ul>
                    <div data-panel="combat" hidden>
                        <p class="dungeon-round" data-round></p>
                        @if ($isGm)
                            <div class="dungeon-combat-actions">
                                <button type="button" class="button button--secondary" data-combat="prev" title="Turno anterior"><x-icon name="undo" :size="14" /></button>
                                <button type="button" class="button" data-combat="start">Iniciar</button>
                                <button type="button" class="button" data-combat="next">Próximo turno</button>
                                <button type="button" class="button button--secondary" data-combat="reroll" title="Rolar iniciativa de todos"><x-icon name="dice" :size="14" /></button>
                                <button type="button" class="button button--secondary" data-combat="reset" title="Encerrar combate"><x-icon name="x" :size="14" /></button>
                            </div>
                        @endif
                        <ol class="pin-list dungeon-turns" data-turns></ol>
                    </div>
                </aside>
            </div>
        </div>

        {{-- Marcador tático --}}
        <x-modal id="dungeon-marker" title="Marcador Tático">
            <form class="form" data-marker-form>
                <x-form.field name="label" label="Nome" required maxlength="255" placeholder="Ex.: Alavanca secreta" />
                <x-form.field name="category" label="Categoria" type="select" :options="array_map(static fn (array $c): string => $c[0], App\Models\DungeonMarker::CATEGORIES)" />
                <x-form.field name="description" label="Descrição" type="textarea" rows="2" maxlength="2000" />
                <p class="field__error" data-marker-error role="alert"></p>
                <div class="modal__actions">
                    <button type="button" class="button button--secondary" data-modal-close>Cancelar</button>
                    <button type="submit" class="button"><x-icon name="save" :size="16" /> Adicionar</button>
                </div>
            </form>
        </x-modal>

        @if ($isGm)
            {{-- Criaturas e personagens (mestre) --}}
            <x-modal id="spawn-token" title="Adicionar ao Mapa" wide>
                <div class="spawn-grid">
                    <section>
                        <p class="eyebrow">Personagens da campanha</p>
                        <div class="chips" data-spawn-characters></div>
                        <p class="eyebrow">Criaturas rápidas</p>
                        <div class="chips" data-spawn-presets></div>
                        <label class="checkbox"><input type="checkbox" data-spawn-hidden> <span>Entrar oculto (só o mestre vê)</span></label>
                    </section>
                    <form class="form" data-spawn-form>
                        <p class="eyebrow">Criatura personalizada</p>
                        <x-form.field name="name" label="Nome" maxlength="255" placeholder="Ex.: Lich Ancestral" />
                        <div class="form-grid">
                            <x-form.field name="hp" label="PV" type="number" min="1" max="99999" value="20" />
                            <x-form.field name="type" label="Tipo" type="select" :options="['monster' => 'Monstro', 'npc' => 'NPC']" />
                            <x-form.field name="size" label="Tamanho" type="select" :options="[1 => '1×1', 2 => '2×2 (grande)', 3 => '3×3 (enorme)', 4 => '4×4 (colossal)']" />
                            <x-form.field name="color" label="Cor" type="color" value="#ef4444" />
                        </div>
                        <p class="field__error" data-spawn-error role="alert"></p>
                        <button type="submit" class="button"><x-icon name="plus" :size="16" /> Colocar no mapa</button>
                    </form>
                </div>
            </x-modal>
        @endif

        <x-action-menu :session="$session" :character="$actionCharacter" :notes="$isGm ? 'campaign' : 'character'" />

        @push('scripts')
            <script type="module" src="{{ asset('js/dungeon/index.js') }}"></script>
        @endpush
    @endif
</x-layouts.app>
