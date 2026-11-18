{{--
    NPCs e monstros da campanha: busca no navegador, vida ao abrir a linha e
    ficha em popup. Gerar novos fica na Forja de NPCs do Painel do Mestre.
--}}
<section class="gm-screen__panel glass" aria-labelledby="screen-npcs-title" data-npc-panel>
    <header class="gm-screen__panel-header">
        <h2 id="screen-npcs-title"><x-icon name="crown" :size="18" /> NPCs & Monstros <span class="tabs__count">{{ $npcs->count() }}</span></h2>
        <a class="button button--link" href="{{ route('gm.sessions.show', [$session, 'aba' => 'mesa', 'tipo' => 'npcs']) }}" title="Gerar NPCs e monstros na Forja do Painel do Mestre">
            <x-icon name="sparkles" :size="14" /> Forja
        </a>
    </header>

    @if ($npcs->isEmpty())
        <x-empty-state icon="crown" hint="Use a Forja de NPCs no Painel do Mestre.">Nenhum NPC ou monstro ainda.</x-empty-state>
    @else
        <div class="screen-npc-tools">
            <label class="search-field">
                <x-icon name="search" :size="16" />
                <span class="visually-hidden">Buscar NPC</span>
                <input class="field__input" type="search" placeholder="Buscar por nome ou classe..." data-npc-search>
            </label>
            <div class="segmented" role="group" aria-label="Tipo">
                <button type="button" class="segmented__option" aria-pressed="true" data-npc-kind="all">Todos</button>
                <button type="button" class="segmented__option" aria-pressed="false" data-npc-kind="npc">NPCs</button>
                <button type="button" class="segmented__option" aria-pressed="false" data-npc-kind="monster">Monstros</button>
            </div>
        </div>

        <ul class="screen-npcs" data-npc-list>
            @foreach ($npcs as $character)
                @php
                    $current = (int) ($character->current_pv ?? $character->max_pv);
                    $percent = (int) $character->max_pv > 0 ? $current / (int) $character->max_pv * 100 : 0;
                    $state = match (true) {
                        $current <= 0 => 'down',
                        $percent <= 25 => 'critical',
                        $percent <= 50 => 'wounded',
                        default => 'healthy',
                    };
                @endphp
                <li class="screen-npc" data-health-card data-state="{{ $state }}" data-npc data-kind="{{ $character->is_monster ? 'monster' : 'npc' }}" data-search="{{ mb_strtolower($character->name.' '.$character->class) }}">
                    <details>
                        <summary>
                            @include('gm.screen.partials.portrait', ['character' => $character])
                            <span class="screen-npc__name">
                                <strong>{{ $character->name }}</strong>
                                <small class="muted">{{ $character->class ?: ($character->is_monster ? 'Monstro' : 'NPC') }} · Nv {{ $character->level }}</small>
                            </span>
                            <span class="screen-npc__pv" title="Pontos de vida"><x-icon name="heart" :size="12" /> <span data-health-current>{{ $current }}</span></span>
                        </summary>

                        <div class="screen-npc__body">
                            @include('gm.screen.partials.health', ['character' => $character])
                            <button type="button" class="button button--secondary button--block" data-sheet-open="{{ route('characters.show', $character) }}" data-sheet-name="{{ $character->name }}">
                                <x-icon name="scroll-text" :size="14" /> Ver ficha
                            </button>
                        </div>
                    </details>
                </li>
            @endforeach
        </ul>
        <p class="muted screen-npcs__empty" data-npc-empty hidden>Nenhum NPC com este filtro.</p>
    @endif
</section>
