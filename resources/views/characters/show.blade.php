@php
    $derived = $sheet['derived'];
    $totals = $sheet['totals'];
    $maxPv = max(0, $derived['pv']);
    $pvPercent = $maxPv > 0 ? max(0, min(100, round($character->current_pv / $maxPv * 100))) : 0;
    $signed = fn (int $value): string => $value > 0 ? '+'.$value : (string) $value;
    $icons = [
        'Shield' => 'shield', 'Sword' => 'sword', 'Zap' => 'zap', 'Flame' => 'flame', 'Eye' => 'eye',
        'Brain' => 'brain', 'Heart' => 'heart', 'Activity' => 'activity', 'Scroll' => 'scroll',
        'Dice6' => 'dice', 'Sparkles' => 'sparkles',
    ];
@endphp

<x-layouts.app :title="'Ficha · '.$character->name">
    @push('styles')
        <link rel="stylesheet" href="@asset('css/sheet.css')">
    @endpush

    {{-- Cabeçalho --}}
    <header class="sheet-header glass">
        <span class="sheet-header__portrait">
            @if ($character->image_url)
                <img src="{{ $character->image_url }}" alt="Retrato de {{ $character->name }}" referrerpolicy="no-referrer">
            @else
                <x-icon :name="$icons[$character->icon] ?? 'shield'" :size="40" />
            @endif
        </span>

        <div class="sheet-header__main">
            <div class="sheet-header__title">
                <h1 class="text-glow-arcane">{{ $character->name }}</h1>
                <span class="badge badge--pill badge--gm">Nível {{ $character->level }}</span>
                @if ($character->is_npc) <span class="badge badge--pill badge--admin">NPC</span> @endif
            </div>
            <p class="eyebrow sheet-header__class">
                <x-icon :name="$icons[$character->icon] ?? 'shield'" :size="14" />
                {{ $character->class ?: 'Sem classe' }}
                @if ($character->user_id !== auth()->id())
                    · Jogador: {{ $character->user?->name ?? 'sem dono' }}
                @endif
            </p>

            <div class="sheet-header__campaign">
                @if ($character->gameSession)
                    <span class="badge badge--pill badge--player"><x-icon name="shield" :size="12" /> Campanha: {{ $character->gameSession->name }}</span>
                    @if ($canEdit)
                        <form method="POST" action="{{ route('characters.campaign', $character) }}">
                            @csrf
                            @method('PUT')
                            <input type="hidden" name="game_session_id" value="">
                            <button type="submit" class="button--link sheet-link">Sair da campanha</button>
                        </form>
                    @endif
                @elseif ($canEdit && $sessions->isNotEmpty())
                    <form class="inline-form" method="POST" action="{{ route('characters.campaign', $character) }}">
                        @csrf
                        @method('PUT')
                        <label class="visually-hidden" for="campaign-select">Campanha</label>
                        <select class="select" id="campaign-select" name="game_session_id" required>
                            <option value="">Vincular a uma campanha...</option>
                            @foreach ($sessions as $session)
                                <option value="{{ $session->id }}">{{ $session->name }}</option>
                            @endforeach
                        </select>
                        <button type="submit" class="button button--secondary"><x-icon name="plus" :size="14" /> Vincular</button>
                    </form>
                @else
                    <span class="badge badge--pill">Sem campanha</span>
                @endif
            </div>

            <dl class="sheet-quick">
                <div><dt>DEF</dt><dd><x-icon name="shield" :size="16" /> {{ $derived['defesa'] }}</dd></div>
                <div><dt>PROT</dt><dd><x-icon name="shield" :size="16" /> {{ $character->protection }}</dd></div>
                <div @class(['sheet-quick__pv', 'is-low' => $maxPv > 0 && $character->current_pv <= $maxPv * 0.25])>
                    <dt>PV</dt>
                    <dd><x-icon name="heart" :size="16" /> {{ $character->current_pv }} / {{ $maxPv }}@if ($character->temp_pv > 0) <small>(+{{ $character->temp_pv }} temp)</small>@endif</dd>
                </div>
                <div><dt>ATP</dt><dd><x-icon name="zap" :size="16" /> {{ $character->current_atp }} / {{ max(0, $derived['atp']) }}</dd></div>
                @isset($totals['ini']) <div><dt>INI</dt><dd><x-icon name="zap" :size="16" /> {{ $signed($totals['ini']) }}</dd></div> @endisset
                @isset($totals['vel']) <div><dt>VEL</dt><dd><x-icon name="activity" :size="16" /> {{ $totals['vel'] }}</dd></div> @endisset
                <div><dt>MO</dt><dd><x-icon name="coins" :size="16" /> {{ number_format($character->money, 0, ',', '.') }}</dd></div>
            </dl>
        </div>

        <div class="sheet-header__actions">
            @can('use-feature', 'journal')
                <a class="icon-button icon-button--bordered" href="{{ route('journal.index', ['visao' => 'personagem', 'personagem' => $character->id]) }}" title="Diário do personagem" aria-label="Diário do personagem"><x-icon name="book-open" /></a>
            @endcan
            @can('use-feature', 'inventory')
                <a class="button button--secondary" href="{{ route('inventory.show', $character) }}"><x-icon name="backpack" :size="16" /> Inventário</a>
            @endcan
        </div>
    </header>

    {{-- Resultado do último teste --}}
    @if ($test)
        <div @class([
            'test-result', 'glass',
            'test-result--critical' => $test['is_critical'],
            'test-result--fumble' => $test['is_fumble'] && ! $test['is_critical'],
            'test-result--success' => $test['success'] && ! $test['is_critical'] && ! $test['is_fumble'],
            'test-result--failure' => ! $test['success'] && ! $test['is_fumble'],
        ]) role="status">
            <span class="test-result__roll">{{ $test['roll'] }}</span>
            <div>
                <p class="eyebrow">{{ $test['label'] }} · {{ $test['detail'] }}</p>
                <p class="test-result__outcome">
                    @if ($test['is_critical']) Acerto Crítico!
                    @elseif ($test['is_fumble']) Falha Crítica!
                    @elseif ($test['success']) Sucesso!
                    @else Falha!
                    @endif
                </p>
            </div>
        </div>
    @endif

    @if ($errors->any())
        <div class="alert alert--error" role="alert">{{ $errors->first() }}</div>
    @endif

    {{-- Atalhos para as seções (a ficha é longa, principalmente no celular); a seção visível fica destacada. --}}
    <nav class="tabs sheet-sections" aria-label="Seções da ficha" data-scrollspy>
        @foreach (['dados' => 'Dados', 'atributos' => 'Atributos', 'combate' => 'Combate', 'estado' => 'Estado', 'talentos' => 'Talentos', 'pericias' => 'Perícias', 'poderes' => 'Poderes', 'tracos' => 'Traços', 'equipados' => 'Equipados'] as $anchor => $label)
            <a class="tabs__link" href="#{{ $anchor }}">{{ $label }}</a>
        @endforeach
    </nav>

    <div class="sheet-grid">
        {{-- Coluna da esquerda: atributos e combate --}}
        <div class="sheet-grid__side">
            <section class="sheet-card glass" id="dados">
                <div class="sheet-card__header">
                    <h2 class="sheet-card__title">Dados Básicos</h2>
                    @if ($isGm)
                        <form method="POST" action="{{ route('characters.unlock', $character) }}">
                            @csrf
                            @method('PUT')
                            <button type="submit" @class(['lock-toggle', 'is-open' => $character->can_edit_stats]) title="O jogador só edita a ficha quando o mestre libera">
                                <x-icon :name="$character->can_edit_stats ? 'check' : 'shield'" :size="14" />
                                {{ $character->can_edit_stats ? 'Edição liberada' : 'Edição bloqueada' }}
                            </button>
                        </form>
                    @elseif (! $canEditStats && $canEdit)
                        <span class="badge badge--pill" title="Peça ao mestre para liberar a edição">Edição bloqueada</span>
                    @endif
                </div>

                <dl class="combat-grid">
                    <div><dt>Pontos de atributo</dt><dd>{{ $character->attribute_points }}</dd></div>
                    <div><dt>Pontos de perícia</dt><dd>{{ $character->skill_points }}</dd></div>
                    <div><dt>Pontos de poder</dt><dd>{{ $character->power_points }}</dd></div>
                    <div><dt>XP</dt><dd>{{ number_format($character->xp, 0, ',', '.') }}@if ($character->xp_max > 0)<small> / {{ number_format($character->xp_max, 0, ',', '.') }}</small>@endif</dd></div>
                </dl>

                @if ($canEditStats)
                    <form class="form" method="POST" action="{{ route('characters.details', $character) }}" enctype="multipart/form-data">
                        @csrf
                        @method('PUT')
                        <x-form.field name="name" label="Nome da lenda" :value="$character->name" required maxlength="255" />
                        <x-form.field name="class" label="Classe / vocação" :value="$character->class" maxlength="255" />
                        <x-form.field name="image" label="Retrato" type="file" accept="image/jpeg,image/png,image/webp,image/gif" hint="JPG, PNG, WEBP ou GIF, até 4 MB." />
                        @if ($character->image_path)
                            <label class="checkbox">
                                <input type="hidden" name="remove_image" value="0">
                                <input type="checkbox" name="remove_image" value="1"> Remover retrato atual
                            </label>
                        @endif
                        <button type="submit" class="button button--secondary"><x-icon name="save" :size="16" /> Salvar dados</button>
                    </form>
                @endif
            </section>

            <section class="sheet-card glass" id="atributos">
                <h2 class="sheet-card__title">Atributos</h2>
                @if ($character->attribute_points > 0)
                    <p class="badge badge--pill badge--player">{{ $character->attribute_points }} pontos disponíveis</p>
                @endif

                <ul class="attribute-list">
                    @foreach ($sheet['attributes'] as $attribute)
                        <li class="attribute">
                            <details class="attribute__details">
                                <summary class="attribute__summary">
                                    <span class="attribute__name">{{ $attribute['label'] }} <small>{{ strtoupper($attribute['id']) }}</small></span>
                                    <span class="attribute__total">{{ $attribute['total'] }}</span>
                                </summary>

                                <dl class="composition">
                                    <div><dt>Base</dt><dd>{{ $attribute['base'] }}</dd></div>
                                    <div><dt>Modificador</dt><dd>{{ $signed($attribute['mod']) }}</dd></div>
                                    <div @class(['is-disregarded' => $attribute['trait_disregarded']]) @if ($attribute['trait_disregarded']) title="Desconsiderado: o atributo já tem modificador próprio" @endif>
                                        <dt>Traços</dt><dd>{{ $signed($attribute['raw_trait']) }}</dd>
                                    </div>
                                    <div><dt>Itens equipados</dt><dd>{{ $signed($attribute['item']) }}</dd></div>
                                    <div><dt>Mestre</dt><dd>{{ $signed($attribute['gm']) }}</dd></div>
                                </dl>
                                @include('characters.partials.gm-entries', ['entries' => $attribute['gm_entries']])
                            </details>

                            <div class="attribute__actions">
                                @if ($canEdit)
                                    <x-sheet.test-buttons :character="$character" :target="'attr:'.$attribute['id']" :label="$attribute['label']" :rules="$rules" />
                                @endif
                                @if ($isGm)
                                    <button type="button" class="gm-button" data-modal-open="gm-modifier" data-modal-value-target="{{ $attribute['id'] }}" title="Modificador do mestre em {{ $attribute['label'] }}">GM</button>
                                @endif
                            </div>
                        </li>
                    @endforeach
                </ul>
            </section>

            <section class="sheet-card glass" id="combate">
                <h2 class="sheet-card__title">Status de Combate</h2>

                <dl class="combat-grid">
                    <div><dt>PV máximo</dt><dd>{{ $maxPv }}</dd></div>
                    <div><dt>ATP máximo</dt><dd>{{ max(0, $derived['atp']) }}</dd></div>
                    <div><dt>Soco</dt><dd>{{ $derived['soco'] }}</dd></div>
                    <div><dt>Chute</dt><dd>{{ $derived['chute'] }}</dd></div>
                </dl>

                <ul class="attribute-list">
                    @foreach (\App\Game\CharacterSheet::COMBAT_TESTS as $key => $label)
                        <li class="attribute">
                            <div class="attribute__summary">
                                <span class="attribute__name">{{ $label }}</span>
                                <span class="attribute__total">{{ $derived[$key] }}</span>
                            </div>
                            @if ($canEdit)
                                <x-sheet.test-buttons :character="$character" :target="'combat:'.$key" :label="$label" :rules="$rules" />
                            @endif
                        </li>
                    @endforeach
                </ul>
            </section>
        </div>

        {{-- Coluna principal --}}
        <div class="sheet-grid__main">
            <section class="sheet-card glass" id="estado">
                <h2 class="sheet-card__title">Estado Atual</h2>

                <div class="pv-bar" role="progressbar" aria-label="Pontos de vida" aria-valuemin="0" aria-valuemax="100" aria-valuenow="{{ $pvPercent }}">
                    <div class="pv-bar__fill" style="width: {{ $pvPercent }}%"></div>
                    <span class="pv-bar__label">{{ $character->current_pv }} / {{ $maxPv }} PV</span>
                </div>

                @if ($canEdit)
                    <form class="vitals" method="POST" action="{{ route('characters.vitals', $character) }}">
                        @csrf
                        @method('PUT')

                        @foreach ([
                            ['current_pv', 'PV atual', $character->current_pv, -9999, $maxPv],
                            ['temp_pv', 'PV temporário', $character->temp_pv, 0, 9999],
                            ['current_atp', 'ATP atual', $character->current_atp, 0, max(0, $derived['atp'])],
                            ['protection', 'Proteção (armaduras: '.$sheet['armor_bonus'].')', $character->protection, 0, $sheet['armor_bonus']],
                            ['sanity', 'Sanidade', $character->sanity, 0, \App\Game\CharacterSheet::TRACK_MAX],
                            ['awakening', 'Despertar', $character->awakening, 0, \App\Game\CharacterSheet::TRACK_MAX],
                        ] as [$name, $label, $current, $min, $max])
                            <div class="stepper">
                                <label class="field__label" for="vital-{{ $name }}">{{ $label }}</label>
                                <div class="stepper__control">
                                    <button type="button" class="icon-button icon-button--bordered" data-step="-1" data-step-for="vital-{{ $name }}" aria-label="Diminuir {{ $label }}">−</button>
                                    <input class="field__input" id="vital-{{ $name }}" type="number" name="{{ $name }}" value="{{ old($name, $current) }}" min="{{ $min }}" max="{{ $max }}" required>
                                    <button type="button" class="icon-button icon-button--bordered" data-step="1" data-step-for="vital-{{ $name }}" aria-label="Aumentar {{ $label }}">+</button>
                                </div>
                            </div>
                        @endforeach

                        <div class="vitals__actions">
                            <button type="button" class="button button--secondary" data-fill-max>Recuperar tudo</button>
                            <button type="submit" class="button"><x-icon name="save" :size="16" /> Salvar estado</button>
                        </div>
                    </form>
                @else
                    <dl class="combat-grid">
                        <div><dt>PV temporário</dt><dd>{{ $character->temp_pv }}</dd></div>
                        <div><dt>ATP</dt><dd>{{ $character->current_atp }}</dd></div>
                        <div><dt>Sanidade</dt><dd>{{ $character->sanity }} / 7</dd></div>
                        <div><dt>Despertar</dt><dd>{{ $character->awakening }} / 7</dd></div>
                    </dl>
                @endif
            </section>

            <section class="sheet-card glass" id="talentos">
                <h2 class="sheet-card__title"><x-icon name="sparkles" :size="22" /> Talentos</h2>

                {{-- Os campos de modificador usam form="talent-mods" porque cada cartão já tem o formulário de teste. --}}
                @if ($canEditStats)
                    <form id="talent-mods" method="POST" action="{{ route('characters.talent-mods', $character) }}">
                        @csrf
                        @method('PUT')
                    </form>
                @endif

                <div class="talent-grid">
                    @forelse ($sheet['talents'] as $talent)
                        <article class="talent">
                            <div class="talent__head">
                                <div>
                                    <h3 class="talent__name">{{ $talent['name'] }}</h3>
                                    <p class="talent__composition">
                                        {{ implode(' + ', array_map('strtoupper', $talent['composition'])) ?: '—' }}
                                        @if ($talent['mod'] !== 0) · mod {{ $signed($talent['mod']) }} @endif
                                        @if ($talent['trait'] !== 0) · traços {{ $signed($talent['trait']) }} @endif
                                        @if ($talent['gm'] !== 0) · mestre {{ $signed($talent['gm']) }} @endif
                                    </p>
                                </div>
                                <span class="talent__total">{{ $talent['total'] }}</span>
                            </div>

                            @include('characters.partials.gm-entries', ['entries' => $talent['gm_entries']])

                            <div class="attribute__actions">
                                @if ($canEdit)
                                    <x-sheet.test-buttons :character="$character" :target="'talent:'.$talent['id']" :label="$talent['name']" :rules="$rules" />
                                @endif
                                @if ($canEditStats)
                                    <label class="talent__mod">
                                        <span>Mod</span>
                                        <input class="field__input" type="number" form="talent-mods" name="talent_mods[{{ $talent['id'] }}]" value="{{ $talent['mod'] }}" min="-100" max="100" aria-label="Modificador manual de {{ $talent['name'] }}">
                                    </label>
                                @endif
                                @if ($isGm)
                                    <button type="button" class="gm-button" data-modal-open="gm-modifier" data-modal-value-target="talent:{{ $talent['id'] }}" title="Modificador do mestre em {{ $talent['name'] }}">GM</button>
                                @endif
                            </div>
                        </article>
                    @empty
                        <p class="muted">Nenhum talento cadastrado na biblioteca.</p>
                    @endforelse
                </div>

                @if ($canEditStats && $sheet['talents'] !== [])
                    <div class="form-actions">
                        <button type="submit" form="talent-mods" class="button button--secondary"><x-icon name="save" :size="16" /> Salvar modificadores</button>
                    </div>
                @endif
            </section>

            @foreach (['skills' => ['pericias', 'Perícias', 'sword', 'skill', 'Nenhuma perícia na ficha.'], 'powers' => ['poderes', 'Poderes', 'zap', 'power', 'Nenhum poder na ficha.']] as $list => [$anchor, $title, $icon, $prefix, $emptyText])
                @php
                    $routeBase = $list === 'skills' ? 'characters.skills' : 'characters.powers';
                    $points = $list === 'skills' ? $character->skill_points : $character->power_points;
                @endphp
                <section class="sheet-card glass" id="{{ $anchor }}">
                    <div class="sheet-card__header">
                        <h2 class="sheet-card__title"><x-icon :name="$icon" :size="22" /> {{ $title }}</h2>
                        @if ($canEditStats)
                            <span class="badge badge--pill badge--admin">{{ $points }} pontos disponíveis</span>
                        @endif
                    </div>

                    @if ($canEditStats && $library[$list]->isNotEmpty())
                        <form class="library-add" method="POST" action="{{ route($routeBase.'.store', $character) }}">
                            @csrf
                            <label class="visually-hidden" for="add-{{ $list }}">Adicionar da biblioteca</label>
                            <select class="select" id="add-{{ $list }}" name="ability_id" required>
                                <option value="">Adicionar da biblioteca...</option>
                                @foreach ($library[$list] as $option)
                                    <option value="{{ $option->id }}" @disabled($option->purchase_cost > $points)>{{ $option->name }} ({{ $option->type }}) · {{ $option->purchase_cost }} pts</option>
                                @endforeach
                            </select>
                            <button type="submit" class="button button--secondary"><x-icon name="plus" :size="16" /> Adicionar</button>
                        </form>
                    @endif

                    @forelse ($sheet[$list] as $ability)
                        <article class="ability">
                            <div class="ability__head">
                                <div>
                                    <h3 class="ability__name">{{ $ability['name'] }}</h3>
                                    <p class="ability__meta">
                                        <span class="badge badge--pill">{{ $ability['type'] }}</span>
                                        <span>Nível {{ $ability['level'] }}</span>
                                        <span>Custo {{ $ability['cost'] }} pts</span>
                                        @if ($ability['usage_cost']) <span>Uso: {{ $ability['usage_cost'] }}</span> @endif
                                        @if ($ability['damage']) <span>Dano: {{ $ability['damage'] }}</span> @endif
                                    </p>
                                </div>
                                <div class="ability__side">
                                    @if ($ability['difficulty'] !== null)
                                        <span class="ability__difficulty" title="Dificuldade ({{ $ability['difficulty_formula'] }})">{{ $ability['difficulty'] }}</span>
                                    @endif
                                    @if ($canEditStats)
                                        <button
                                            type="button"
                                            class="icon-button"
                                            title="Remover da ficha"
                                            aria-label="Remover {{ $ability['name'] }}"
                                            data-modal-open="confirm-delete"
                                            data-modal-action="{{ route($routeBase.'.destroy', [$character, $ability['id']]) }}"
                                            data-modal-text-name="{{ $ability['name'] }} (os pontos de compra são devolvidos)"
                                        ><x-icon name="trash" :size="16" /></button>
                                    @endif
                                </div>
                            </div>
                            @if ($ability['effect']) <p class="ability__text"><strong>Efeito:</strong> {{ $ability['effect'] }}</p> @endif
                            @if ($ability['description']) <p class="ability__text">{{ $ability['description'] }}</p> @endif
                            @if ($canEdit && $ability['difficulty'] !== null)
                                <x-sheet.test-buttons :character="$character" :target="$prefix.':'.$ability['id']" :label="$ability['name']" :rules="$rules" />
                            @endif
                        </article>
                    @empty
                        <p class="muted">{{ $emptyText }}</p>
                    @endforelse
                </section>
            @endforeach

            <section class="sheet-card glass" id="tracos">
                <h2 class="sheet-card__title"><x-icon name="sparkles" :size="22" /> Vantagens & Defeitos</h2>

                @if ($canEditStats && $library['traits']->isNotEmpty())
                    <form class="library-add" method="POST" action="{{ route('characters.traits.store', $character) }}">
                        @csrf
                        <label class="visually-hidden" for="add-trait">Adicionar vantagem ou defeito</label>
                        <select class="select" id="add-trait" name="trait_id" required>
                            <option value="">Adicionar da biblioteca...</option>
                            @foreach ($library['traits']->groupBy(fn ($trait) => $trait->type?->label() ?? 'Outros') as $group => $options)
                                <optgroup label="{{ $group }}">
                                    @foreach ($options as $option)
                                        <option value="{{ $option->id }}">{{ $option->name }}</option>
                                    @endforeach
                                </optgroup>
                            @endforeach
                        </select>
                        <button type="submit" class="button button--secondary"><x-icon name="plus" :size="16" /> Adicionar</button>
                    </form>
                @endif

                @forelse ($sheet['traits'] as $trait)
                    <article @class(['ability', 'ability--advantage' => $trait['advantage'], 'ability--disadvantage' => ! $trait['advantage']])>
                        <div class="ability__head">
                            <div>
                                <h3 class="ability__name">{{ $trait['name'] }}</h3>
                                <p class="ability__meta">
                                    <span @class(['badge', 'badge--pill', 'badge--gm' => $trait['advantage'], 'badge--player' => ! $trait['advantage']])>{{ $trait['advantage'] ? 'Vantagem' : 'Defeito' }}</span>
                                    <span>{{ $signed($trait['modifier']) }} em {{ $trait['target'] }}</span>
                                    <span>{{ $trait['cost'] }} pts</span>
                                </p>
                            </div>
                            @if ($canEditStats)
                                <button
                                    type="button"
                                    class="icon-button"
                                    title="Remover da ficha"
                                    aria-label="Remover {{ $trait['name'] }}"
                                    data-modal-open="confirm-delete"
                                    data-modal-action="{{ route('characters.traits.destroy', [$character, $trait['id']]) }}"
                                    data-modal-text-name="{{ $trait['name'] }}"
                                ><x-icon name="trash" :size="16" /></button>
                            @endif
                        </div>
                        @if ($trait['effect']) <p class="ability__text"><strong>Efeito:</strong> {{ $trait['effect'] }}</p> @endif
                        @if ($trait['description']) <p class="ability__text">{{ $trait['description'] }}</p> @endif
                    </article>
                @empty
                    <p class="muted">Nenhuma vantagem ou defeito selecionado.</p>
                @endforelse
            </section>

            <section class="sheet-card glass" id="equipados">
                <h2 class="sheet-card__title"><x-icon name="backpack" :size="22" /> Itens Equipados</h2>

                @forelse ($sheet['equipped'] as $item)
                    <article class="ability">
                        <div class="ability__head">
                            <div>
                                <h3 class="ability__name">{{ $item->name }}</h3>
                                <p class="ability__meta">
                                    <span class="badge badge--pill rarity rarity--{{ strtolower($item->rarityKey()) }}">{{ $item->rarityLabel() }}</span>
                                    @if ($item->damage) <span>Dano: {{ $item->damage }}</span> @endif
                                    @if ($item->defense) <span>Defesa +{{ $item->defense }}</span> @endif
                                    @foreach ((array) $item->stats as $attribute => $bonus)
                                        <span>{{ strtoupper($attribute) }} {{ $signed((int) $bonus) }}</span>
                                    @endforeach
                                </p>
                            </div>
                        </div>
                    </article>
                @empty
                    <p class="muted">Nenhum item equipado.</p>
                @endforelse
            </section>
        </div>
    </div>

    {{-- Mapas da campanha (CampaignMapsCharacterTab.tsx): jogadores veem miniaturas genéricas. --}}
    @if ($campaignMaps->isNotEmpty())
        <x-section title="Mapas da Campanha" icon="map">
            <x-slot:action>
                @if ($mapsAsGm && auth()->user()->can('use-feature', 'mapManager'))
                    <a class="button button--link" href="{{ route('map-manager.index', ['campanha' => $character->game_session_id]) }}">Gerenciar mapas</a>
                @endif
            </x-slot:action>
            <div class="campaign-maps">
                @foreach ($campaignMaps as $map)
                    @php
                        $isWorld = $map->type === App\Enums\MapType::World;
                        $mapUrl = $isWorld
                            ? (auth()->user()->can('use-feature', 'worldMap') ? route('world-map.index', ['campanha' => $character->game_session_id, 'mapa' => $map->id]) : null)
                            : (auth()->user()->can('use-feature', 'dungeon') ? route('dungeon.index', ['campanha' => $character->game_session_id, 'mapa' => $map->id]) : null);
                    @endphp
                    <{{ $mapUrl ? 'a' : 'div' }} class="campaign-map glass" @if ($mapUrl) href="{{ $mapUrl }}" @endif>
                        <img src="{{ $map->thumbnailUrl($mapsAsGm) }}" alt="" loading="lazy">
                        <span>
                            <strong>{{ $map->name }}</strong>
                            <small>{{ $isWorld ? 'Mapa do mundo' : 'Masmorra' }}@if ($mapsAsGm && ! $map->active_in_session) · oculto dos jogadores @endif</small>
                        </span>
                    </{{ $mapUrl ? 'a' : 'div' }}>
                @endforeach
            </div>
        </x-section>
    @endif

    @if ($isGm)
        @php
            $gmTargets = collect($sheet['attributes'])->mapWithKeys(fn ($attribute) => [$attribute['id'] => 'Atributo · '.$attribute['label']])->all()
                + collect($sheet['talents'])->mapWithKeys(fn ($talent) => ['talent:'.$talent['id'] => 'Talento · '.$talent['name']])->all();
        @endphp
        <x-modal id="gm-modifier" title="Modificador do Mestre" :open-on-load="$errors->hasAny(['target', 'value', 'justification'])">
            <form class="form" method="POST" action="{{ route('characters.gm-modifiers.store', $character) }}">
                @csrf
                <x-form.field name="target" label="Alvo" type="select" :options="$gmTargets" required data-modal-value="target" />
                <x-form.field name="value" label="Valor" type="number" value="1" min="-100" max="100" required hint="Use negativo para penalidades." />
                <x-form.field name="justification" label="Justificativa" type="textarea" rows="3" maxlength="500" required placeholder="Ex.: Bênção do templo de Eldoria" />
                <div class="modal__actions">
                    <button type="button" class="button button--secondary" data-modal-close>Cancelar</button>
                    <button type="submit" class="button button--gold"><x-icon name="save" :size="16" /> Aplicar</button>
                </div>
            </form>
        </x-modal>
    @endif

    @if ($canEditStats || $isGm)
        <x-catalog.delete-modal type="da ficha" />
    @endif

    {{-- Testes rápidos (F, N, D, E): o resultado abre numa janela, sem recarregar a ficha. --}}
    @if ($canEdit)
        <x-roll-dialog />
    @endif

    @push('scripts')
        <script type="module" src="@asset('js/sheet/vitals.js')"></script>
    @endpush
    {{-- Menu de ações: dados, chat da campanha (as rolagens também aparecem nele) e anotações. --}}
    <x-action-menu :session="$character->gameSession" :character="$character" />
</x-layouts.app>
