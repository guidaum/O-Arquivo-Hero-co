{{--
    Referência rápida das regras da campanha (o "escudo" de verdade): testes,
    dificuldades, fórmulas de combate, atributos e ganhos por nível. Tudo vem
    de GameRules::forSession (regras da campanha ou as Configurações Base).
--}}
@php
    $formulaLabels = [
        'pv' => 'Pontos de Vida (PV)',
        'atp' => 'Pontos de Ação (ATP)',
        'defesa' => 'Defesa',
        'esquiva' => 'Esquiva',
        'en' => 'Esquiva Natural (E/N)',
        'dm' => 'D/M',
        'soco' => 'Soco',
        'chute' => 'Chute',
    ];
    $number = static fn (float $value): string => rtrim(rtrim(number_format($value, 2, ',', ''), '0'), ',');
@endphp

<div class="screen-rules">
    <section class="screen-rules__block">
        <h3><x-icon name="dice" :size="16" /> Testes</h3>
        <ul class="screen-rules__list">
            <li>Role <strong>igual ou abaixo</strong> da meta para passar.</li>
            <li>Atributos rolam <strong>d10</strong>; talentos, perícias, poderes e combate rolam <strong>d20</strong>.</li>
            <li><strong>1</strong> natural é <span class="screen-rules__critical">crítico</span>; a face máxima é <span class="screen-rules__fumble">falha crítica</span>.</li>
        </ul>
    </section>

    <section class="screen-rules__block">
        <h3><x-icon name="target" :size="16" /> Dificuldade (meta)</h3>
        <table class="screen-rules__table">
            <thead><tr><th scope="col">Dificuldade</th><th scope="col">Meta</th><th scope="col">Valor 10</th></tr></thead>
            <tbody>
                <tr><th scope="row">Fácil</th><td>valor + {{ $number($rules['easy']) }}</td><td>{{ (int) floor(10 + $rules['easy']) }}</td></tr>
                <tr><th scope="row">Normal</th><td>valor</td><td>10</td></tr>
                <tr><th scope="row">Difícil</th><td>valor ÷ {{ $number($rules['hard']) }}</td><td>{{ (int) floor(10 / $rules['hard']) }}</td></tr>
                <tr><th scope="row">Extremo</th><td>valor ÷ {{ $number($rules['extreme']) }}</td><td>{{ (int) floor(10 / $rules['extreme']) }}</td></tr>
            </tbody>
        </table>
        <p class="muted">A meta é arredondada para baixo.</p>
    </section>

    <section class="screen-rules__block">
        <h3><x-icon name="swords" :size="16" /> Fórmulas de combate</h3>
        <dl class="screen-rules__formulas">
            @foreach ($rules['formulas'] as $key => $formula)
                <div>
                    <dt>{{ $formulaLabels[$key] ?? strtoupper($key) }}</dt>
                    <dd><code>{{ $formula }}</code></dd>
                </div>
            @endforeach
        </dl>
    </section>

    <section class="screen-rules__block">
        <h3><x-icon name="activity" :size="16" /> Atributos</h3>
        <ul class="screen-rules__attributes">
            @foreach ($rules['attributes'] as $attribute)
                <li><code>{{ strtoupper($attribute['id']) }}</code> {{ $attribute['label'] }}</li>
            @endforeach
        </ul>
    </section>

    <section class="screen-rules__block">
        <h3><x-icon name="chevron-up" :size="16" /> Ganhos por nível</h3>
        <ul class="screen-rules__list">
            <li><strong>{{ $rules['progression']['attr_points_per_level'] }}</strong> pontos de atributo</li>
            <li><strong>{{ $rules['progression']['skill_points_per_level'] }}</strong> pontos de perícia</li>
            <li><strong>{{ $rules['progression']['power_points_per_level'] }}</strong> pontos de poder</li>
        </ul>
        <a class="link-arrow" href="{{ route('gm.sessions.rules.edit', $session) }}">Regras da campanha <x-icon name="arrow-right" :size="14" /></a>
    </section>
</div>
