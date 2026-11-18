{{--
    Mapas da campanha (mundo e masmorras): abrir, e mostrar/ocultar dos
    jogadores pela mesma rota do Gerenciador de Mapas (map-manager.active).
--}}
@php
    $groups = [
        ['title' => 'Mapas do Mundo', 'icon' => 'compass', 'maps' => $worldMaps, 'route' => 'world-map.index', 'feature' => 'worldMap', 'type' => 'world'],
        ['title' => 'Masmorras', 'icon' => 'castle', 'maps' => $dungeonMaps, 'route' => 'dungeon.index', 'feature' => 'dungeon', 'type' => 'dungeon'],
    ];
@endphp

@foreach ($groups as $group)
    <div class="screen-maps">
        <header class="screen-maps__header">
            <h3><x-icon :name="$group['icon']" :size="16" /> {{ $group['title'] }}</h3>
            @can('use-feature', 'mapManager')
                <a class="button button--link" href="{{ route('map-manager.index', ['campanha' => $session->id, 'tipo' => $group['type']]) }}">Gerenciar <x-icon name="arrow-right" :size="14" /></a>
            @endcan
        </header>

        @if ($group['maps']->isEmpty())
            <p class="muted">Nenhum mapa disponível.</p>
        @else
            <ul class="screen-maps__list">
                @foreach ($group['maps'] as $map)
                    <li class="screen-map" @if (! $map->active_in_session) data-hidden-map @endif>
                        <img src="{{ $map->thumbnailUrl(true) }}" alt="" loading="lazy" data-no-zoom>
                        <div class="screen-map__info">
                            <strong>{{ $map->name }}</strong>
                            <span @class(['badge', 'badge--pill', 'badge--player' => $map->active_in_session])>
                                <x-icon :name="$map->active_in_session ? 'eye' : 'eye-off'" :size="12" />
                                {{ $map->active_in_session ? 'Visível aos jogadores' : 'Oculto' }}
                            </span>
                        </div>
                        <div class="screen-map__actions">
                            @can('use-feature', 'mapManager')
                                <form method="POST" action="{{ route('map-manager.active', [$session, $map]) }}">
                                    @csrf
                                    @method('PUT')
                                    <input type="hidden" name="active" value="{{ $map->active_in_session ? 0 : 1 }}">
                                    <button type="submit" class="icon-button icon-button--bordered" title="{{ $map->active_in_session ? 'Ocultar dos jogadores' : 'Mostrar aos jogadores' }}">
                                        <x-icon :name="$map->active_in_session ? 'eye-off' : 'eye'" :size="16" />
                                        <span class="visually-hidden">{{ $map->active_in_session ? 'Ocultar' : 'Mostrar' }} {{ $map->name }}</span>
                                    </button>
                                </form>
                            @endcan
                            @can('use-feature', $group['feature'])
                                <a class="icon-button icon-button--bordered" href="{{ route($group['route'], ['campanha' => $session->id, 'mapa' => $map->id]) }}" title="Abrir o mapa">
                                    <x-icon name="arrow-right" :size="16" />
                                    <span class="visually-hidden">Abrir {{ $map->name }}</span>
                                </a>
                            @endcan
                        </div>
                    </li>
                @endforeach
            </ul>
        @endif
    </div>
@endforeach
