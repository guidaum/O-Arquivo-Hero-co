{{--
    Gerador de encontros (EncounterGeneratorModal.tsx): orçamento de XP pelos
    níveis dos personagens de jogadores, sorteio no servidor e ajuste das
    quantidades no navegador antes de colocar na masmorra (public/js/gm/encounter.js).
--}}
<div class="gm-encounter" data-encounter data-budgets="{{ json_encode($budgets) }}">
    <section class="gm-encounter__party glass">
        <p class="eyebrow">O grupo</p>
        <p>
            @if ($partyLevels === [])
                Sem personagens de jogadores: o orçamento considera <strong>4 aventureiros de nível 1</strong>.
            @else
                <strong>{{ $budgets['party_size'] }}</strong> {{ $budgets['party_size'] === 1 ? 'aventureiro' : 'aventureiros' }},
                nível médio <strong>{{ $budgets['avg_level'] }}</strong>
                <span class="muted">(níveis {{ implode(', ', $partyLevels) }})</span>
            @endif
        </p>
        <dl class="gm-encounter__budgets">
            @foreach (App\Game\Bestiary::DIFFICULTIES as $label => $key)
                <div class="is-{{ $key }}"><dt>{{ $label }}</dt><dd>{{ number_format($budgets[$key], 0, ',', '.') }} XP</dd></div>
            @endforeach
        </dl>
    </section>

    <form class="gm-encounter__form glass" data-encounter-form>
        <x-form.field name="ambiente" label="Ambiente" type="select" :options="App\Game\Bestiary::ENVIRONMENTS" value="dungeon" id="encounter-environment" />
        <x-form.field name="dificuldade" label="Dificuldade" type="select" :options="array_combine(array_keys(App\Game\Bestiary::DIFFICULTIES), array_keys(App\Game\Bestiary::DIFFICULTIES))" value="Médio" id="encounter-difficulty" />
        <x-form.field name="tatica" label="Tática" type="select" :options="App\Game\Bestiary::TACTICS" value="balanced" id="encounter-tactic" />
        <button type="submit" class="button button--ember"><x-icon name="dice" :size="16" /> Gerar encontro</button>
    </form>

    <section class="gm-encounter__result glass" data-encounter-result hidden>
        <header class="gm-encounter__header">
            <div>
                <p class="eyebrow" data-encounter-tactic></p>
                <h2 data-encounter-name></h2>
            </div>
            <span class="badge badge--pill" data-encounter-rating></span>
        </header>

        <dl class="gm-encounter__xp">
            <div><dt>Alvo</dt><dd data-encounter-target></dd></div>
            <div><dt>XP total</dt><dd data-encounter-total></dd></div>
            <div><dt>XP ajustado</dt><dd data-encounter-adjusted></dd></div>
        </dl>

        <ul class="gm-encounter__groups" data-encounter-groups></ul>

        @include('gm.sessions.partials.spawn-target', ['prefix' => 'encounter'])

        <div class="form-actions">
            <button type="button" class="button button--secondary" data-encounter-reroll><x-icon name="rotate-ccw" :size="16" /> Sortear de novo</button>
            <button type="button" class="button button--ember" data-encounter-spawn @disabled($dungeonMaps->isEmpty())>
                <x-icon name="map-pin" :size="16" /> Colocar encontro no mapa
            </button>
        </div>
    </section>
</div>
