{{-- Masmorra de destino das criaturas do bestiário e dos encontros. --}}
<div class="gm-spawn-target glass" data-spawn-target>
    @if ($dungeonMaps->isEmpty())
        <p class="muted">
            <x-icon name="alert-triangle" :size="16" />
            A campanha ainda não tem masmorras. Cadastre ou ative uma no
            <a href="{{ route('map-manager.index', ['campanha' => $session->id, 'tipo' => 'dungeon']) }}">Gerenciador de Mapas</a>
            para colocar criaturas no battlemap.
        </p>
    @else
        <label class="gm-spawn-target__field" for="{{ $prefix }}-map">
            <span class="eyebrow">Masmorra de destino</span>
            <select class="select" id="{{ $prefix }}-map" data-spawn-map>
                @foreach ($dungeonMaps as $map)
                    <option value="{{ $map->id }}" data-url="{{ route('dungeon.index', ['campanha' => $session->id, 'mapa' => $map->id]) }}">
                        {{ $map->name }}{{ $map->active_in_session ? '' : ' (oculta aos jogadores)' }}
                    </option>
                @endforeach
            </select>
        </label>
        <label class="checkbox">
            <input type="checkbox" checked data-spawn-hidden>
            Criaturas ocultas aos jogadores
        </label>
        <a class="button button--secondary button--pill" href="#" data-spawn-open><x-icon name="skull" :size="14" /> Abrir masmorra</a>
    @endif
</div>
