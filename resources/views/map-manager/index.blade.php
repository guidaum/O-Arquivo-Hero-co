{{--
    Gerenciador de Mapas (MapManager.tsx): mapas do mundo e masmorras da
    campanha, ativação para os jogadores, camadas e névoa de guerra.
--}}
@php
    $filterUrl = static fn (array $query): string => route('map-manager.index', array_filter([
        'campanha' => $session?->id,
        'tipo' => $type?->value,
        'origem' => $source !== 'all' ? $source : null,
        ...$query,
    ], static fn ($value): bool => $value !== null && $value !== 'all'));
@endphp

<x-layouts.app title="Gerenciador de Mapas">
    @push('styles')
        <link rel="stylesheet" href="{{ asset('css/map-manager.css') }}">
    @endpush

    <x-page-header title="Forja Cartográfica" subtitle="Gerenciador de Mapas da Campanha">
        <x-slot:badges>
            <span class="badge badge--pill badge--gm"><x-icon name="shield" :size="12" /> Mestre</span>
        </x-slot:badges>

        <x-slot:actions>
            @if ($session)
                <form method="GET" action="{{ route('map-manager.index') }}" class="map-manager__campaign">
                    <select class="select" name="campanha" data-autosubmit aria-label="Campanha">
                        @foreach ($sessions as $option)
                            <option value="{{ $option->id }}" @selected($option->id === $session->id)>{{ $option->name }}</option>
                        @endforeach
                    </select>
                </form>
                <a class="button button--secondary button--pill" href="{{ route('map-manager.studio', $session) }}"><x-icon name="pencil" /> Estúdio de Esboços</a>
                <button type="button" class="button button--pill" data-modal-open="create-map"><x-icon name="plus" /> Novo Mapa</button>
            @endif
        </x-slot:actions>
    </x-page-header>

    @if ($session === null)
        <x-empty-state>
            Você ainda não mestra nenhuma campanha. Crie uma com "Mestrar" no painel inicial para cadastrar mapas.
        </x-empty-state>
    @else
        @if ($errors->editMap->isNotEmpty())
            <div class="alert alert--error" role="alert">
                <strong>Não foi possível salvar o mapa:</strong> {{ $errors->editMap->first() }}
            </div>
        @endif

        <div class="stat-cards map-manager__stats">
            @foreach ([
                ['Mapas na campanha', $stats['total'], 'map', ''],
                ['Visíveis aos jogadores', $stats['active'], 'eye', 'stat-card--success'],
                ['Mapas do mundo', $stats['world'], 'compass', 'stat-card--gold'],
                ['Masmorras', $stats['dungeon'], 'skull', 'stat-card--ember'],
            ] as [$label, $value, $icon, $tone])
                <div class="stat-card glass {{ $tone }}">
                    <div class="stat-card__top">
                        <span class="stat-card__icon"><x-icon :name="$icon" :size="24" /></span>
                        <span class="stat-card__value">{{ $value }}</span>
                    </div>
                    <p class="stat-card__label">{{ $label }}</p>
                </div>
            @endforeach
        </div>

        <div class="toolbar map-manager__filters">
            <nav class="tabs tabs--small" aria-label="Tipo de mapa">
                @foreach (['all' => 'Todos', 'world' => 'Mundo', 'dungeon' => 'Masmorras'] as $key => $label)
                    <a class="tabs__link" href="{{ $filterUrl(['tipo' => $key]) }}" @if (($type?->value ?? 'all') === $key) aria-current="page" @endif>{{ $label }}</a>
                @endforeach
            </nav>
            <nav class="tabs tabs--small" aria-label="Origem">
                @foreach (['all' => 'Todos', 'custom' => 'Meus mapas ('.$stats['custom'].')', 'presets' => 'Modelos base'] as $key => $label)
                    <a class="tabs__link" href="{{ $filterUrl(['origem' => $key]) }}" @if ($source === $key) aria-current="page" @endif>{{ $label }}</a>
                @endforeach
            </nav>
        </div>

        @if ($maps->isEmpty())
            <x-empty-state>Nenhum mapa com estes filtros. Use "Novo Mapa" para enviar a imagem de um mapa da sua campanha.</x-empty-state>
        @else
            <div class="map-grid">
                @foreach ($maps as $map)
                    @php
                        $isWorld = $map->type === App\Enums\MapType::World;
                        $layers = App\Models\GameSessionMap::normalizeLayers($map->session_layer_settings);
                        $viewUrl = $isWorld
                            ? route('world-map.index', ['campanha' => $session->id, 'mapa' => $map->id])
                            : (auth()->user()->can('use-feature', 'dungeon') ? route('dungeon.index', ['campanha' => $session->id, 'mapa' => $map->id]) : null);
                    @endphp
                    <article @class(['map-card', 'glass', 'is-inactive' => ! $map->active_in_session])>
                        <div class="map-card__preview" style="--cols: {{ $map->gridCols() }}; --rows: {{ $map->gridRows() }}; --grid-opacity: {{ $layers['show_grid'] ? $layers['grid_opacity'] / 100 : 0 }}; --background-opacity: {{ $layers['show_background'] ? $layers['background_opacity'] / 100 : 0.15 }}">
                            <img src="{{ $map->thumbnailUrl(true) }}" alt="" loading="lazy">
                            @unless ($isWorld)
                                <span class="map-card__grid" aria-hidden="true"></span>
                            @endunless
                            <span class="map-card__badges">
                                <span @class(['badge', 'badge--pill', 'map-card__status', 'is-active' => $map->active_in_session])>
                                    <x-icon :name="$map->active_in_session ? 'eye' : 'eye-off'" :size="12" />
                                    {{ $map->active_in_session ? 'Ativo' : 'Oculto' }}
                                </span>
                                <span class="badge badge--pill">{{ $isWorld ? 'Mundo' : 'Masmorra' }}</span>
                                @if ($map->fog['enabled'])
                                    <span class="badge badge--pill">Névoa</span>
                                @endif
                                <span class="badge badge--pill">{{ $map->isPreset() ? 'Modelo base' : 'Personalizado' }}</span>
                            </span>
                            <span class="map-card__spec">
                                {{ $isWorld ? ($map->default_scale ?: 'Escala livre') : $map->gridCols().'×'.$map->gridRows().' · '.($map->theme ?: 'Masmorra') }}
                            </span>
                        </div>

                        <div class="map-card__body">
                            <h2>{{ $map->name }}</h2>
                            <p class="muted">{{ $map->subtitle }}</p>
                        </div>

                        <div class="map-card__actions">
                            @if ($viewUrl)
                                <a class="button button--secondary" href="{{ $viewUrl }}"><x-icon name="eye" :size="16" /> Ver</a>
                            @endif
                            <a class="button button--secondary" href="{{ route('map-manager.layers', [$session, $map]) }}"><x-icon name="layers" :size="16" /> Camadas</a>

                            <form method="POST" action="{{ route('map-manager.active', [$session, $map]) }}">
                                @csrf
                                @method('PUT')
                                <input type="hidden" name="active" value="{{ $map->active_in_session ? 0 : 1 }}">
                                <button type="submit" @class(['button', 'button--secondary' => $map->active_in_session])>
                                    <x-icon :name="$map->active_in_session ? 'eye-off' : 'eye'" :size="16" />
                                    {{ $map->active_in_session ? 'Ocultar' : 'Ativar' }}
                                </button>
                            </form>

                            @can('update', $map)
                                <button type="button" class="icon-button icon-button--bordered" title="Editar mapa"
                                    data-edit-map="{{ json_encode([
                                        'action' => route('map-manager.update', [$session, $map]),
                                        'type' => $map->type->value,
                                        'name' => $map->name,
                                        'subtitle' => $map->subtitle,
                                        'default_scale' => $map->default_scale,
                                        'theme' => $map->theme,
                                        'grid_cols' => $map->gridCols(),
                                        'grid_rows' => $map->gridRows(),
                                        'active' => (bool) $map->active_in_session,
                                        'image_url' => $map->image_url,
                                    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) }}">
                                    <x-icon name="pencil" :size="16" />
                                </button>
                            @endcan
                            @can('delete', $map)
                                <button type="button" class="icon-button icon-button--bordered icon-button--danger" title="Excluir mapa"
                                    data-modal-open="confirm-delete"
                                    data-modal-action="{{ route('map-manager.destroy', [$session, $map]) }}"
                                    data-modal-text-name="{{ $map->name }}">
                                    <x-icon name="trash" :size="16" />
                                </button>
                            @endcan
                        </div>
                    </article>
                @endforeach
            </div>
        @endif

        {{-- Novo mapa --}}
        <x-modal id="create-map" title="Novo Mapa da Campanha" wide :open-on-load="$errors->createMap->isNotEmpty()">
            <form method="POST" action="{{ route('map-manager.store', $session) }}" enctype="multipart/form-data" class="form" data-map-form>
                @csrf
                <fieldset class="field">
                    <legend class="field__label">Tipo</legend>
                    <div class="segmented segmented--full" role="group">
                        @foreach (['world' => ['compass', 'Mapa do Mundo'], 'dungeon' => ['skull', 'Masmorra / Battlemap']] as $value => [$icon, $label])
                            <label class="map-type-choice">
                                <input type="radio" name="type" value="{{ $value }}" data-map-type @checked(old('type', 'world') === $value)>
                                <span><x-icon :name="$icon" :size="16" /> {{ $label }}</span>
                            </label>
                        @endforeach
                    </div>
                </fieldset>

                @include('map-manager.partials.map-fields', ['bag' => 'createMap', 'map' => null])

                <div class="modal__actions">
                    <button type="button" class="button button--secondary" data-modal-close>Cancelar</button>
                    <button type="submit" class="button"><x-icon name="save" :size="16" /> Criar Mapa</button>
                </div>
            </form>
        </x-modal>

        {{-- Editar mapa personalizado (preenchido por public/js/map-manager/index.js) --}}
        <x-modal id="edit-map" title="Editar Mapa" wide>
            <form method="POST" action="#" enctype="multipart/form-data" class="form" data-map-form data-edit-form>
                @csrf
                @method('PUT')
                @include('map-manager.partials.map-fields', ['bag' => 'editMap', 'map' => true])
                <label class="checkbox">
                    <input type="checkbox" name="active" value="1" data-edit-active>
                    <span>Visível para os jogadores</span>
                </label>
                <div class="modal__actions">
                    <button type="button" class="button button--secondary" data-modal-close>Cancelar</button>
                    <button type="submit" class="button"><x-icon name="save" :size="16" /> Salvar</button>
                </div>
            </form>
        </x-modal>

        <x-catalog.delete-modal type="mapa" warning="Os marcadores, desenhos, tokens e a névoa deste mapa também serão apagados." />

        @push('scripts')
            <script type="module" src="{{ asset('js/map-manager/index.js') }}"></script>
        @endpush
    @endif
</x-layouts.app>
