{{--
    Mapa do Mundo (WorldMap.tsx). A estrutura vem do servidor; marcadores,
    desenhos e sinais chegam por polling (public/js/world-map/index.js).
--}}
<x-layouts.app title="Mapa do Mundo" full>
    @push('styles')
        <link rel="stylesheet" href="@asset('css/world-map.css')">
    @endpush

    @if ($session === null)
        <div class="world-map-empty">
            <x-empty-state>
                Você ainda não participa de nenhuma campanha. Entre em uma com o código do mestre no painel inicial para explorar o mapa.
            </x-empty-state>
        </div>
    @elseif ($map === null)
        <div class="world-map-empty">
            <section class="world-map-empty__card glass">
                <span class="icon-tile icon-tile--large"><x-icon name="eye-off" :size="28" /></span>
                <h1>Nenhum Mapa do Mundo Ativo</h1>
                <p class="muted">O Mestre da campanha "{{ $session->name }}" não ativou nenhum mapa do mundo para exploração. Aguarde as instruções do Mestre!</p>
                @if ($sessions->count() > 1)
                    <form method="GET" action="{{ route('world-map.index') }}">
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
        <div class="world-map" data-world-map data-config="{{ json_encode($config, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) }}">
            {{-- Barra superior --}}
            <header class="world-map__bar glass">
                {{-- Aberto pela ficha ("?ficha="): volta para ela. --}}
                <x-sheet-back compact />
                <details class="dropdown world-map__selector" data-dropdown>
                    <summary aria-haspopup="menu">
                        <span class="icon-tile"><x-icon name="map" :size="18" /></span>
                        <span class="world-map__identity">
                            <strong>{{ $map->name }}</strong>
                            <small>{{ $map->subtitle ?: 'Mapa da campanha' }}@if ($map->default_scale) · {{ $map->default_scale }}@endif</small>
                        </span>
                        <x-icon name="chevron-down" :size="16" />
                    </summary>
                    <div class="dropdown__menu world-map__maps">
                        <div class="dropdown__header"><p class="eyebrow">Mapas do mundo da campanha</p></div>
                        @foreach ($maps as $option)
                            <div @class(['world-map__map-option', 'is-current' => $option->id === $map->id])>
                                <a href="{{ route('world-map.index', ['campanha' => $session->id, 'mapa' => $option->id]) }}">
                                    <img src="{{ $isGm ? ($option->image_url ?? asset('images/maps/generic-world-thumb.jpg')) : asset('images/maps/generic-world-thumb.jpg') }}" alt="" loading="lazy">
                                    <span>
                                        <strong>{{ $option->name }}</strong>
                                        <small>{{ $option->subtitle }}</small>
                                    </span>
                                </a>
                                @if ($isGm)
                                    <label class="switch" title="Visível para os jogadores">
                                        <input type="checkbox" data-map-active="{{ route('world-map.active', [$session, $option]) }}" @checked($option->active_in_session)>
                                        <span class="switch__track"><span class="switch__thumb"></span></span>
                                    </label>
                                @endif
                            </div>
                        @endforeach
                        @if ($isGm)
                            @can('use-feature', 'mapManager')
                                <a class="dropdown__item" href="{{ route('map-manager.index') }}"><x-icon name="sliders" :size="16" /> <strong>Gerenciar mapas</strong></a>
                            @endcan
                        @endif
                    </div>
                </details>

                <form method="GET" action="{{ route('world-map.index') }}" class="world-map__session">
                    <select class="select" name="campanha" data-autosubmit aria-label="Campanha">
                        @foreach ($sessions as $option)
                            <option value="{{ $option->id }}" @selected($option->id === $session->id)>{{ $option->name }}</option>
                        @endforeach
                    </select>
                    @if ($isGm)
                        <span class="badge badge--pill badge--gm"><x-icon name="shield" :size="12" /> Mestre</span>
                    @endif
                </form>

                <div class="world-map__tools" role="toolbar" aria-label="Ferramentas do mapa">
                    <button type="button" class="tool-toggle" data-mode="pin" aria-pressed="false" title="Adicionar marcador (clique no mapa)"><x-icon name="map-pin" :size="18" /><span>Marcador</span></button>
                    <button type="button" class="tool-toggle" data-mode="draw" aria-pressed="false" title="Desenhar no mapa (mestre e jogadores)"><x-icon name="pencil" :size="18" /><span>Desenhar</span></button>
                    <button type="button" class="tool-toggle" data-mode="ping" aria-pressed="false" title="Sinal: clique no mapa para avisar a todos (ou Shift + clique)"><x-icon name="radio" :size="18" /><span>Sinal</span></button>
                    @if ($config['dungeonUrl'])
                        <a class="tool-toggle" href="{{ $config['dungeonUrl'] }}" title="Battlemaps de masmorras"><x-icon name="skull" :size="18" /><span>Masmorras</span></a>
                    @endif
                    <button type="button" class="tool-toggle" data-sidebar-toggle-map aria-pressed="true" title="Mostrar ou ocultar a lista de marcadores"><x-icon name="panel-right" :size="18" /></button>
                </div>
            </header>

            <div class="world-map__body">
                {{-- Área do mapa --}}
                <div class="world-map__viewport" data-viewport>
                    <p class="world-map__banner" data-banner hidden></p>

                    <div class="world-map__filters chips" data-category-bar></div>

                    <div class="world-map__stage" data-stage>
                        <img class="world-map__image" src="{{ $map->image_url }}" alt="{{ $map->name }}" draggable="false" data-map-image>
                        <div class="world-map__grid" data-grid aria-hidden="true">
                            @foreach (range(0, 9) as $column)
                                <span class="world-map__grid-col" style="left: {{ $column * 10 + 5 }}%">{{ chr(65 + $column) }}</span>
                            @endforeach
                            @foreach (range(1, 10) as $row)
                                <span class="world-map__grid-row" style="top: {{ ($row - 1) * 10 + 5 }}%">{{ $row }}</span>
                            @endforeach
                        </div>
                        <svg class="world-map__drawings" data-drawings viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"></svg>
                        <div class="world-map__pins" data-pins></div>
                        <div class="world-map__pings" data-pings aria-live="polite"></div>
                    </div>

                    {{-- Ferramentas de desenho --}}
                    <div class="draw-toolbar glass" data-draw-toolbar hidden>
                        <div class="draw-toolbar__group" role="group" aria-label="Ferramenta">
                            <button type="button" class="icon-button" data-draw-tool="pen" aria-pressed="true" title="Caneta livre (fecha e preenche ao unir as pontas)"><x-icon name="pencil" :size="16" /></button>
                            <button type="button" class="icon-button" data-draw-tool="polygon" aria-pressed="false" title="Polígono: clique para adicionar vértices e feche no ponto inicial (ou duplo clique)"><x-icon name="pentagon" :size="16" /></button>
                            <button type="button" class="icon-button" data-draw-tool="eraser" aria-pressed="false" title="Borracha: clique sobre um traço para apagar"><x-icon name="eraser" :size="16" /></button>
                        </div>
                        <div class="draw-toolbar__group" role="group" aria-label="Cor" data-draw-colors></div>
                        <div class="draw-toolbar__group" role="group" aria-label="Espessura" data-draw-sizes></div>
                        <div class="draw-toolbar__group">
                            <button type="button" class="icon-button" data-draw-undo title="Desfazer (Ctrl + Z)"><x-icon name="undo" :size="16" /></button>
                            <button type="button" class="icon-button" data-draw-redo title="Refazer (Ctrl + Y)"><x-icon name="redo" :size="16" /></button>
                            <button type="button" class="icon-button" data-draw-clear="mine" title="Limpar meus desenhos"><x-icon name="trash" :size="16" /></button>
                            @if ($isGm)
                                <button type="button" class="icon-button icon-button--danger" data-draw-clear="all" title="Limpar TODOS os desenhos (Mestre)"><x-icon name="trash" :size="16" /><small>Todos</small></button>
                            @endif
                        </div>
                    </div>

                    {{-- Controles de visualização --}}
                    <div class="world-map__controls glass">
                        <button type="button" class="icon-button" data-zoom="in" title="Aproximar"><x-icon name="zoom-in" :size="18" /></button>
                        <span class="world-map__zoom" data-zoom-label>100%</span>
                        <button type="button" class="icon-button" data-zoom="out" title="Afastar"><x-icon name="zoom-out" :size="18" /></button>
                        <button type="button" class="icon-button" data-zoom="reset" title="Centralizar"><x-icon name="locate" :size="18" /></button>
                        <button type="button" class="icon-button" data-grid-toggle aria-pressed="true" title="Grade cartográfica (A–J / 1–10)"><x-icon name="grid" :size="18" /></button>
                    </div>

                    <p class="world-map__coords glass" data-coords>Passe o cursor sobre o mapa</p>
                </div>

                {{-- Lista de marcadores --}}
                <aside class="world-map__sidebar glass" data-sidebar>
                    <header class="world-map__sidebar-header">
                        <h2>Marcadores</h2>
                        <span class="badge badge--pill" data-pin-count>0</span>
                    </header>
                    <input class="field__input" type="search" placeholder="Buscar marcadores..." data-pin-search aria-label="Buscar marcadores">
                    <select class="select" data-pin-category aria-label="Categoria">
                        <option value="all">Todas as categorias</option>
                        @foreach (App\Models\MapPin::CATEGORIES as $key => $category)
                            <option value="{{ $key }}">{{ $category['label'] }}</option>
                        @endforeach
                    </select>
                    <ul class="pin-list" data-pin-list></ul>
                    <p class="world-map__hint muted">Clique em "Marcador" e depois no mapa para registrar um local. Shift + clique envia um sinal.</p>
                </aside>
            </div>
        </div>

        {{-- Detalhe do marcador --}}
        <x-modal id="pin-detail" title="Marcador">
            <div class="pin-detail" data-pin-detail></div>
            <div class="modal__actions">
                <button type="button" class="button button--danger" data-pin-delete hidden><x-icon name="trash" :size="16" /> Excluir</button>
                <a class="button button--secondary" data-pin-dungeon hidden><x-icon name="skull" :size="16" /> Entrar no Battlemap</a>
                <button type="button" class="button button--secondary" data-pin-edit hidden><x-icon name="pencil" :size="16" /> Editar</button>
                <button type="button" class="button" data-modal-close>Fechar</button>
            </div>
        </x-modal>

        {{-- Criar / editar marcador --}}
        <x-modal id="pin-form" title="Novo Marcador" wide>
            <form class="form pin-form" data-pin-form>
                <p class="pin-form__coords" data-pin-coords></p>
                <x-form.field name="title" label="Título" required maxlength="255" placeholder="Ex.: Cidadela de Aethel" />

                <fieldset class="field">
                    <legend class="field__label">Categoria</legend>
                    <div class="pin-form__categories">
                        @foreach (App\Models\MapPin::CATEGORIES as $key => $category)
                            <label class="pin-choice" style="--pin-color: {{ $category['color'] }}" title="{{ $category['description'] }}">
                                <input type="radio" name="category" value="{{ $key }}" @checked($key === 'dungeon')>
                                <span><x-icon :name="$category['icon']" :size="18" /> {{ $category['short'] }}</span>
                            </label>
                        @endforeach
                    </div>
                </fieldset>

                <fieldset class="field">
                    <legend class="field__label">Ícone do marcador</legend>
                    <div class="pin-form__icons">
                        <label class="pin-icon-choice" title="Ícone da categoria">
                            <input type="radio" name="custom_icon" value="" checked>
                            <span>Padrão</span>
                        </label>
                        @foreach (App\Models\MapPin::ICONS as $key => [$sprite, $label])
                            <label class="pin-icon-choice" title="{{ $label }}">
                                <input type="radio" name="custom_icon" value="{{ $key }}">
                                <span><x-icon :name="$sprite" :size="18" /><span class="visually-hidden">{{ $label }}</span></span>
                            </label>
                        @endforeach
                    </div>
                </fieldset>

                <div class="form-grid">
                    <x-form.field name="danger_level" label="Nível de perigo" type="select" :options="App\Models\MapPin::DANGER_LEVELS" value="moderate" />
                    <x-form.field name="status" label="Situação" type="select" :options="App\Models\MapPin::STATUSES" value="explored" />
                    <x-form.field name="discovered_on" label="Data da descoberta" type="date" />
                </div>

                <x-form.field name="description" label="Descrição / lore" type="textarea" rows="3" maxlength="5000" />

                @if ($isGm)
                    <x-form.field name="secrets" label="Segredos do Mestre (só o mestre vê)" type="textarea" rows="2" maxlength="5000" />
                    <label class="checkbox">
                        <input type="checkbox" name="is_secret" value="1">
                        <span>Marcador secreto (oculto dos jogadores)</span>
                    </label>
                @endif

                <p class="field__error" data-pin-error role="alert"></p>
                <div class="modal__actions">
                    <button type="button" class="button button--secondary" data-modal-close>Cancelar</button>
                    <button type="submit" class="button"><x-icon name="save" :size="16" /> Salvar marcador</button>
                </div>
            </form>
        </x-modal>

        @push('scripts')
            <script type="module" src="@asset('js/world-map/index.js')"></script>
        @endpush
    @endif
</x-layouts.app>
