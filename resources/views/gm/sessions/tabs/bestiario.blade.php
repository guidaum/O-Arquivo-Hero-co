{{--
    Bestiário oficial (BestiaryModal.tsx): filtros no navegador, ficha de
    cada criatura e envio para uma masmorra da campanha (public/js/gm/bestiary.js).
--}}
@php
    $types = collect($monsters)->pluck('type')->unique()->sort()->values();
@endphp

<div class="gm-bestiary" data-bestiary>
    @include('gm.sessions.partials.spawn-target', ['prefix' => 'bestiary'])

    <div class="toolbar">
        <label class="search-field">
            <span class="visually-hidden">Buscar criatura</span>
            <x-icon name="search" :size="18" />
            <input class="field__input" type="search" placeholder="Buscar criatura..." data-bestiary-search>
        </label>
        <select class="select" data-bestiary-environment aria-label="Ambiente">
            <option value="">Todos os ambientes</option>
            @foreach (App\Game\Bestiary::ENVIRONMENTS as $key => $label)
                <option value="{{ $key }}">{{ $label }}</option>
            @endforeach
        </select>
        <select class="select" data-bestiary-type aria-label="Tipo">
            <option value="">Todos os tipos</option>
            @foreach ($types as $type)
                <option value="{{ $type }}">{{ $type }}</option>
            @endforeach
        </select>
        <span class="muted" data-bestiary-count>{{ count($monsters) }} criaturas</span>
    </div>

    <div class="gm-bestiary__grid">
        @foreach ($monsters as $monster)
            <article
                class="gm-monster glass"
                data-monster="{{ $monster['id'] }}"
                data-name="{{ mb_strtolower($monster['name']) }}"
                data-type="{{ $monster['type'] }}"
                data-environments="{{ implode(' ', $monster['environments']) }}"
                style="--accent: {{ $monster['color'] ?? '#ef4444' }}"
            >
                <header class="gm-monster__header">
                    <div>
                        <h3>{{ $monster['name'] }}</h3>
                        <p class="muted">{{ $monster['size'] }} · {{ $monster['type'] }} · {{ $monster['alignment'] }}</p>
                    </div>
                    <span class="gm-monster__cr" title="Nível de desafio">ND {{ $monster['cr'] }}<small>{{ $monster['xp'] }} XP</small></span>
                </header>

                <dl class="gm-monster__vitals">
                    <div><dt>CA</dt><dd>{{ $monster['ac'] }}</dd></div>
                    <div><dt>PV</dt><dd>{{ $monster['hp'] }}</dd></div>
                    <div><dt>Iniciativa</dt><dd>{{ ($monster['initiativeBonus'] ?? 0) >= 0 ? '+' : '' }}{{ $monster['initiativeBonus'] ?? 0 }}</dd></div>
                </dl>
                <p class="gm-monster__speed muted"><x-icon name="activity" :size="14" /> {{ $monster['speed'] }}</p>

                <details class="gm-monster__details">
                    <summary>Ficha completa</summary>

                    <p class="gm-monster__description">{{ $monster['description'] }}</p>

                    <dl class="gm-monster__stats">
                        @foreach ($monster['stats'] as $attribute => $value)
                            <div><dt>{{ strtoupper($attribute) }}</dt><dd>{{ $value }}</dd></div>
                        @endforeach
                    </dl>

                    <p class="muted"><strong>Dados de vida:</strong> {{ $monster['hitDice'] }} · <strong>Sentidos:</strong> {{ $monster['senses'] }} · <strong>Idiomas:</strong> {{ $monster['languages'] }}</p>

                    @if (! empty($monster['traits']))
                        <h4>Características</h4>
                        <ul class="gm-monster__list">
                            @foreach ($monster['traits'] as $trait)
                                <li><strong>{{ $trait['name'] }}.</strong> {{ $trait['description'] }}</li>
                            @endforeach
                        </ul>
                    @endif

                    @if (! empty($monster['actions']))
                        <h4>Ações</h4>
                        <ul class="gm-monster__list">
                            @foreach ($monster['actions'] as $action)
                                <li>
                                    <strong>{{ $action['name'] }}.</strong> {{ $action['description'] }}
                                    @if (! empty($action['damage']))
                                        <button
                                            type="button"
                                            class="chip gm-monster__roll"
                                            data-roll-damage="{{ $action['damage'] }}"
                                            title="Rolar dano no rolador de dados"
                                        ><x-icon name="dice" :size="12" /> {{ $action['damage'] }}</button>
                                    @endif
                                </li>
                            @endforeach
                        </ul>
                    @endif
                </details>

                <footer class="gm-monster__spawn">
                    <label class="visually-hidden" for="monster-count-{{ $monster['id'] }}">Quantidade</label>
                    <input class="field__input" id="monster-count-{{ $monster['id'] }}" type="number" min="1" max="30" value="1" data-monster-count>
                    <button type="button" class="button button--ember" data-monster-spawn @disabled($dungeonMaps->isEmpty())>
                        <x-icon name="map-pin" :size="14" /> Colocar no mapa
                    </button>
                </footer>
            </article>
        @endforeach
    </div>

    <x-empty-state data-bestiary-empty hidden>Nenhuma criatura com estes filtros.</x-empty-state>
</div>
