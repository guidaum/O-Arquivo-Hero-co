{{--
    Personagem na mesa do mestre: vida (fetch em public/js/gm/health.js),
    pontos, progressão (formulários), monstro/NPC e envio para a masmorra.
--}}
@php
    $max = (int) $character->max_pv;
    $current = (int) ($character->current_pv ?? $max);
    $temp = max(0, (int) $character->temp_pv);
    $percent = $max > 0 ? max(0, min(100, (int) round($current / $max * 100))) : 0;
    $state = match (true) {
        $current <= 0 => 'down',
        $percent <= 25 => 'critical',
        $percent <= 50 => 'wounded',
        default => 'healthy',
    };
    $readyToLevel = (int) $character->xp_max > 0 && (int) $character->xp >= (int) $character->xp_max;
    $isPlayer = ! $character->is_npc;
@endphp

<article class="gm-character glass" id="personagem-{{ $character->id }}" data-health-card data-state="{{ $state }}">
    <header class="gm-character__header">
        <span class="gm-character__portrait" style="--accent: {{ preg_match('/^#[0-9a-fA-F]{6}$/', (string) $character->color) ? $character->color : 'var(--arcane)' }}">
            @if ($character->image_url)
                <img src="{{ $character->image_url }}" alt="" loading="lazy">
            @else
                <x-icon :name="$character->is_monster ? 'skull' : ($isPlayer ? 'user' : 'crown')" :size="22" />
            @endif
        </span>

        <div class="gm-character__title">
            <h3><a href="{{ route('characters.show', $character) }}">{{ $character->name }}</a></h3>
            <p class="muted">
                {{ $character->class ?: 'Aventureiro' }} · Nv {{ $character->level }}
                @if ($isPlayer && $character->user)
                    · {{ $character->user->name }}
                @endif
            </p>
        </div>

        <div class="gm-character__badges">
            @if ($character->is_monster)
                <span class="badge badge--pill gm-badge--monster">Monstro</span>
            @elseif ($character->is_npc)
                <span class="badge badge--pill badge--admin">NPC</span>
            @else
                <span class="badge badge--pill badge--player">Jogador</span>
            @endif
            @if ($readyToLevel)
                <span class="badge badge--pill badge--gm" title="O XP chegou ao máximo do nível">Pronto para subir</span>
            @endif
        </div>
    </header>

    <div class="gm-health" data-health data-url="{{ route('gm.sessions.characters.health', [$session, $character]) }}">
        <div class="gm-health__top">
            <span class="gm-health__label"><x-icon :name="$current <= 0 ? 'skull' : 'heart'" :size="16" /> Vida</span>
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
            <label class="visually-hidden" for="health-amount-{{ $character->id }}">Quantidade de PV</label>
            <input class="field__input gm-health__amount" id="health-amount-{{ $character->id }}" type="number" min="1" max="9999" value="5" inputmode="numeric" data-health-amount>
            <button type="button" class="button button--danger" data-health-action="damage"><x-icon name="sword" :size="14" /> Dano</button>
            <button type="button" class="button button--secondary" data-health-action="heal"><x-icon name="heart" :size="14" /> Curar</button>
            <button type="button" class="button button--secondary" data-health-action="temp"><x-icon name="shield" :size="14" /> Temp</button>
        </div>
        <div class="gm-health__quick">
            <button type="button" class="button button--link" data-health-action="short_rest">Descanso curto</button>
            <button type="button" class="button button--link" data-health-action="long_rest">Descanso longo</button>
            <button type="button" class="button button--link" data-health-action="clear_temp">Limpar temp</button>
        </div>
    </div>

    <dl class="gm-character__points">
        <div><dt>Atributo</dt><dd>{{ (int) $character->attribute_points }}</dd></div>
        <div><dt>Perícia</dt><dd>{{ (int) $character->skill_points }}</dd></div>
        <div><dt>Poder</dt><dd>{{ (int) $character->power_points }}</dd></div>
        <div><dt>XP</dt><dd>{{ (int) $character->xp }}<small>/{{ (int) $character->xp_max }}</small></dd></div>
    </dl>

    <details class="gm-character__manage">
        <summary><x-icon name="sliders" :size="14" /> Progressão</summary>

        <div class="gm-character__forms">
            <form method="POST" action="{{ route('gm.sessions.characters.progress', [$session, $character]) }}" class="inline-form">
                @csrf
                @method('PUT')
                <input type="hidden" name="action" value="level_up">
                <label class="visually-hidden" for="levels-{{ $character->id }}">Níveis</label>
                <input class="field__input" id="levels-{{ $character->id }}" type="number" name="amount" value="1" min="1" max="20">
                <button type="submit" class="button button--gold"><x-icon name="chevron-up" :size="14" /> Subir nível</button>
            </form>

            <form method="POST" action="{{ route('gm.sessions.characters.progress', [$session, $character]) }}" class="inline-form">
                @csrf
                @method('PUT')
                <input type="hidden" name="action" value="points">
                <label class="visually-hidden" for="points-type-{{ $character->id }}">Tipo de ponto</label>
                <select class="select" id="points-type-{{ $character->id }}" name="type">
                    <option value="attributes">Atributo</option>
                    <option value="skills">Perícia</option>
                    <option value="powers">Poder</option>
                </select>
                <label class="visually-hidden" for="points-{{ $character->id }}">Pontos</label>
                <input class="field__input" id="points-{{ $character->id }}" type="number" name="amount" value="{{ $progression['skill_points_per_level'] }}" min="-9999" max="9999">
                <button type="submit" class="button button--secondary"><x-icon name="plus" :size="14" /> Pontos</button>
            </form>

            <form method="POST" action="{{ route('gm.sessions.characters.progress', [$session, $character]) }}" class="inline-form">
                @csrf
                @method('PUT')
                <input type="hidden" name="action" value="xp">
                <label class="visually-hidden" for="xp-{{ $character->id }}">XP</label>
                <input class="field__input" id="xp-{{ $character->id }}" type="number" name="amount" value="100" min="-9999" max="9999">
                <button type="submit" class="button button--secondary"><x-icon name="sparkles" :size="14" /> Dar XP</button>
            </form>
        </div>
    </details>

    <footer class="gm-character__actions">
        @if ($dungeonMaps->isNotEmpty())
            <form class="gm-spawn" data-spawn-form action="{{ route('gm.sessions.characters.spawn', [$session, $character]) }}">
                <label class="visually-hidden" for="spawn-map-{{ $character->id }}">Masmorra</label>
                <select class="select" id="spawn-map-{{ $character->id }}" name="map_id">
                    @foreach ($dungeonMaps as $map)
                        <option value="{{ $map->id }}">{{ $map->name }}{{ $map->active_in_session ? '' : ' (oculta)' }}</option>
                    @endforeach
                </select>
                <label class="checkbox"><input type="checkbox" name="hidden" value="1" @checked(! $isPlayer)> Oculto</label>
                <button type="submit" class="icon-button icon-button--bordered" title="Colocar na masmorra">
                    <x-icon name="map-pin" :size="16" />
                    <span class="visually-hidden">Colocar na masmorra</span>
                </button>
            </form>
        @endif

        <div class="gm-character__buttons">
            @if ($character->is_npc)
                <form method="POST" action="{{ route('gm.sessions.characters.monster', [$session, $character]) }}">
                    @csrf
                    @method('PUT')
                    <button type="submit" class="icon-button icon-button--bordered" title="{{ $character->is_monster ? 'Tornar NPC comum' : 'Tornar monstro' }}">
                        <x-icon :name="$character->is_monster ? 'users' : 'skull'" :size="16" />
                        <span class="visually-hidden">{{ $character->is_monster ? 'Tornar NPC comum' : 'Tornar monstro' }}</span>
                    </button>
                </form>
                <button
                    type="button"
                    class="icon-button icon-button--danger"
                    title="Excluir NPC"
                    data-modal-open="confirm-delete"
                    data-modal-action="{{ route('gm.sessions.characters.destroy', [$session, $character]) }}"
                    data-modal-text-name="{{ $character->name }}"
                >
                    <x-icon name="trash" :size="16" />
                    <span class="visually-hidden">Excluir {{ $character->name }}</span>
                </button>
            @endif
            <a class="icon-button icon-button--bordered" href="{{ route('characters.show', $character) }}" title="Abrir ficha">
                <x-icon name="scroll-text" :size="16" />
                <span class="visually-hidden">Abrir ficha</span>
            </a>
        </div>
    </footer>
</article>
