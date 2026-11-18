{{--
    Vida compacta no Escudo do Mestre. Usa os mesmos data-* do Painel do
    Mestre, então public/js/gm/health.js aplica dano/cura pela rota
    gm.sessions.characters.health. Precisa de um [data-health-card] em volta.
--}}
@php
    $max = (int) $character->max_pv;
    $current = (int) ($character->current_pv ?? $max);
    $temp = max(0, (int) $character->temp_pv);
    $percent = $max > 0 ? max(0, min(100, (int) round($current / $max * 100))) : 0;
@endphp

<div class="gm-health gm-health--compact" data-health data-url="{{ route('gm.sessions.characters.health', [$session, $character]) }}">
    <div class="gm-health__top">
        <span class="gm-health__label"><x-icon name="heart" :size="14" /> PV</span>
        <span class="gm-health__value">
            <strong data-health-current>{{ $current }}</strong>/<span data-health-max>{{ $max }}</span>
            <small class="gm-health__temp" data-health-temp @if ($temp === 0) hidden @endif>+{{ $temp }} temp</small>
        </span>
    </div>
    <div class="gm-health__bar" aria-hidden="true">
        <span class="gm-health__fill" data-health-fill style="width: {{ $percent }}%"></span>
        <span class="gm-health__shield" data-health-shield style="width: {{ $max > 0 ? min(100 - $percent, (int) round($temp / $max * 100)) : 0 }}%"></span>
    </div>

    <div class="gm-health__controls">
        <label class="visually-hidden" for="screen-health-{{ $character->id }}">Quantidade de PV de {{ $character->name }}</label>
        <input class="field__input gm-health__amount" id="screen-health-{{ $character->id }}" type="number" min="1" max="9999" value="5" inputmode="numeric" data-health-amount>
        <button type="button" class="button button--danger" data-health-action="damage" title="Aplicar dano (o PV temporário absorve primeiro)"><x-icon name="sword" :size="14" /><span class="visually-hidden">Dano</span></button>
        <button type="button" class="button button--secondary" data-health-action="heal" title="Curar (até o máximo)"><x-icon name="heart" :size="14" /><span class="visually-hidden">Curar</span></button>
        <button type="button" class="button button--secondary" data-health-action="temp" title="Dar PV temporário"><x-icon name="shield" :size="14" /><span class="visually-hidden">PV temporário</span></button>
    </div>
    <div class="gm-health__quick">
        <button type="button" class="button button--link" data-health-action="short_rest">Desc. curto</button>
        <button type="button" class="button button--link" data-health-action="long_rest" data-party-rest>Desc. longo</button>
        <button type="button" class="button button--link" data-health-action="clear_temp">Limpar temp</button>
    </div>
</div>
