@php
    $categories = [
        'weapons' => ['Armas', 'sword', 'ember'],
        'armor' => ['Armaduras', 'shield', 'arcane'],
        'ammo' => ['Munição', 'crosshair', 'gold'],
        'consumables' => ['Consumíveis', 'flask', 'ember'],
        'misc' => ['Diversos', 'scroll', 'parchment'],
    ];
    $loadPercent = $capacity > 0 ? min(100, round($totalWeight / $capacity * 100)) : 0;
    $roll = session('roll');
@endphp

<x-layouts.app :title="'Inventário de '.$character->name">
    @push('styles')
        <link rel="stylesheet" href="@asset('css/inventory.css')">
    @endpush

    <header class="inventory-header">
        <div class="inventory-header__title">
            <span class="icon-tile icon-tile--large icon-tile--gold"><x-icon name="backpack" :size="24" /></span>
            <div>
                <p class="eyebrow">Inventário</p>
                <h1>Inventário de {{ $character->name }}</h1>
            </div>
        </div>

        <div class="inventory-header__stats">
            <div class="inventory-stat glass">
                <span class="inventory-stat__icon inventory-stat__icon--gold"><x-icon name="coins" :size="20" /></span>
                <div>
                    <p class="eyebrow">Dinheiro</p>
                    <p class="inventory-stat__value">{{ number_format($character->money, 0, ',', '.') }} <small>MO</small></p>
                    <p class="inventory-stat__hint">Patrimônio: {{ number_format($character->money + $totalValue, 0, ',', '.') }} MO</p>
                </div>
                @if ($canEdit)
                    <button type="button" class="icon-button" data-modal-open="money" title="Gerenciar dinheiro" aria-label="Gerenciar dinheiro"><x-icon name="plus" :size="16" /></button>
                @endif
            </div>

            <div class="inventory-stat glass">
                <span class="inventory-stat__icon"><x-icon name="weight" :size="20" /></span>
                <div>
                    <p class="eyebrow">Carga</p>
                    <p class="inventory-stat__value">{{ rtrim(rtrim(number_format($totalWeight, 1, ',', '.'), '0'), ',') ?: '0' }} / {{ $capacity }} <small>kg</small></p>
                    <div class="progress__track" role="progressbar" aria-label="Carga" aria-valuemin="0" aria-valuemax="100" aria-valuenow="{{ $loadPercent }}">
                        <div @class(['progress__bar', 'progress__bar--danger' => $loadPercent >= 100]) style="width: {{ $loadPercent }}%"></div>
                    </div>
                </div>
            </div>
        </div>
    </header>

    @if ($errors->has('roll') || $errors->has('purchase') || $errors->has('amount') || $errors->has('suggestion'))
        <div class="alert alert--error" role="alert">{{ $errors->first('roll') ?: $errors->first('purchase') ?: $errors->first('amount') ?: $errors->first('suggestion') }}</div>
    @endif

    @if ($roll)
        <div class="roll-result glass" role="status">
            <span class="roll-result__die"><x-icon name="dice" :size="28" /></span>
            <div>
                <p class="eyebrow">Dano · {{ $roll['label'] }}</p>
                <p class="roll-result__total">{{ $roll['total'] }}</p>
                <p class="muted">{{ $roll['dice'] ?: $roll['detail'] }}</p>
                @if ($roll['ammo']) <p class="roll-result__ammo">{{ $roll['ammo'] }}</p> @endif
            </div>
        </div>
    @endif

    <div class="inventory-layout">
        <nav class="inventory-nav glass" aria-label="Categorias">
            <p class="eyebrow">Navegação</p>

            @if ($canEdit && $shopOpen)
                <a class="inventory-nav__shop" href="{{ route('inventory.shop', $character) }}">
                    <x-icon name="store" :size="20" /> Loja
                </a>
            @endif

            @foreach ($categories as $key => [$label, $icon, $tone])
                <a
                    class="inventory-nav__link inventory-nav__link--{{ $tone }}"
                    href="{{ route('inventory.show', [$character, 'categoria' => $key]) }}"
                    @if ($category === $key) aria-current="page" @endif
                >
                    <x-icon :name="$icon" :size="20" />
                    <span>{{ $label }}</span>
                    <span class="inventory-nav__count">{{ $counts[$key] ?? 0 }}</span>
                </a>
            @endforeach
        </nav>

        <section class="inventory-main">
            <div class="inventory-toolbar">
                <h2 class="section__title"><x-icon :name="$categories[$category][1]" :size="24" /> {{ $categories[$category][0] }}</h2>

                <form class="inventory-toolbar__filters" method="GET" action="{{ route('inventory.show', $character) }}">
                    <input type="hidden" name="categoria" value="{{ $category }}">
                    <label class="visually-hidden" for="filter-rarity">Raridade</label>
                    <select class="select" id="filter-rarity" name="raridade" data-autosubmit>
                        <option value="">Todas as raridades</option>
                        @foreach (\App\Models\CatalogItem::RARITIES as $value => $label)
                            <option value="{{ $value }}" @selected($rarity === $value)>{{ $label }}</option>
                        @endforeach
                    </select>
                    <label class="visually-hidden" for="filter-sort">Ordenar</label>
                    <select class="select" id="filter-sort" name="ordem" data-autosubmit>
                        @foreach ($sorts as $value => $label)
                            <option value="{{ $value }}" @selected($sort === $value)>Ordem: {{ $label }}</option>
                        @endforeach
                    </select>
                    <noscript><button type="submit" class="button button--secondary">Filtrar</button></noscript>
                </form>

                @if ($canEdit)
                    <a class="button" href="{{ route('inventory.items.create', [$character, 'categoria' => $category]) }}"><x-icon name="plus" :size="16" /> Novo Item</a>
                @endif
            </div>

            <div class="item-grid">
                @forelse ($items as $item)
                    <article @class(['item-card', 'glass', 'item-card--equipped' => $item->equipped, 'rarity-border--'.strtolower($item->rarityKey())]) data-item-card="{{ $item->id }}">
                        <div class="item-card__top">
                            <span class="item-card__image">
                                @if ($item->image_url)
                                    <img src="{{ $item->image_url }}" alt="" loading="lazy" referrerpolicy="no-referrer">
                                @else
                                    <x-icon :name="$categories[$item->categoryKey()][1]" :size="26" />
                                @endif
                            </span>
                            <div class="item-card__heading">
                                <h3 class="item-card__name">{{ $item->name }}</h3>
                                <div class="item-card__badges">
                                    <span class="badge badge--pill rarity rarity--{{ strtolower($item->rarityKey()) }}">{{ $item->rarityLabel() }}</span>
                                    @if ($item->equipped) <span class="badge badge--pill badge--gm">Equipado</span> @endif
                                    @if ($item->quantity > 1 || $item->isStackable()) <span class="badge badge--pill badge--admin" data-item-quantity>x{{ $item->quantity }}</span> @endif
                                    @php($suggestion = $itemSuggestions[$item->id] ?? null)
                                    @if ($suggestion?->status === \App\Enums\SuggestionStatus::Pending)
                                        <span class="badge badge--pill badge--player" title="O mestre ainda vai revisar">Sugerido ao mestre</span>
                                    @elseif ($suggestion?->status === \App\Enums\SuggestionStatus::Rejected && $item->catalog_item_id === null)
                                        <span class="badge badge--pill" title="O mestre não adicionou este item à loja">Sugestão recusada</span>
                                    @endif
                                </div>
                            </div>
                        </div>

                        @if ($item->description)
                            <p class="item-card__description">{{ \Illuminate\Support\Str::limit($item->description, 160) }}</p>
                        @endif

                        <dl class="item-card__stats">
                            @if ($item->damage) <div><dt>Dano</dt><dd>{{ $item->damage }}</dd></div> @endif
                            @if ($item->defense) <div><dt>Defesa</dt><dd>+{{ $item->defense }}</dd></div> @endif
                            <div><dt>Peso</dt><dd>{{ rtrim(rtrim(number_format($item->weight, 2, ',', '.'), '0'), ',') ?: '0' }} kg</dd></div>
                            <div><dt>Valor</dt><dd>{{ number_format($item->value, 0, ',', '.') }} MO</dd></div>
                            @foreach ((array) $item->stats as $attribute => $bonus)
                                <div><dt>{{ strtoupper($attribute) }}</dt><dd>{{ $bonus > 0 ? '+'.$bonus : $bonus }}</dd></div>
                            @endforeach
                        </dl>

                        @if ($canEdit)
                            <div class="item-card__actions">
                                @if ($item->damage)
                                    <form method="POST" action="{{ route('inventory.items.roll', [$character, $item]) }}" data-roll-dialog="Dano · {{ $item->name }}">
                                        @csrf
                                        <button type="submit" class="button button--ember"><x-icon name="dice" :size="16" /> Rolar dano</button>
                                    </form>
                                @endif

                                @if (in_array($item->categoryKey(), ['weapons', 'armor', 'misc'], true))
                                    <form method="POST" action="{{ route('inventory.items.equip', [$character, $item]) }}">
                                        @csrf
                                        <button type="submit" class="button button--secondary">{{ $item->equipped ? 'Desequipar' : 'Equipar' }}</button>
                                    </form>
                                @endif

                                @if ($item->categoryKey() === 'consumables')
                                    <form method="POST" action="{{ route('inventory.items.consume', [$character, $item]) }}">
                                        @csrf
                                        <button type="submit" class="button button--secondary"><x-icon name="flask" :size="16" /> Usar</button>
                                    </form>
                                @endif

                                <span class="item-card__tools">
                                    {{-- Item que não veio da loja: o dono pode sugeri-lo ao mestre (uma sugestão pendente por vez). --}}
                                    @if ($canSuggest && $item->catalog_item_id === null && ($itemSuggestions[$item->id] ?? null)?->status !== \App\Enums\SuggestionStatus::Pending)
                                        <form method="POST" action="{{ route('inventory.items.suggest', [$character, $item]) }}">
                                            @csrf
                                            <button type="submit" class="icon-button" title="Sugerir ao mestre para a loja" aria-label="Sugerir {{ $item->name }} ao mestre para a loja"><x-icon name="store" :size="16" /></button>
                                        </form>
                                    @endif
                                    @if ($sort === 'manual' && $rarity === '')
                                        @foreach (['up' => ['chevron-up', 'Mover para cima'], 'down' => ['chevron-down', 'Mover para baixo']] as $direction => [$icon, $label])
                                            <form method="POST" action="{{ route('inventory.items.move', [$character, $item]) }}">
                                                @csrf
                                                <input type="hidden" name="direction" value="{{ $direction }}">
                                                <button type="submit" class="icon-button" title="{{ $label }}" aria-label="{{ $label }}" @disabled(($direction === 'up' && $loop->parent->first) || ($direction === 'down' && $loop->parent->last))><x-icon :name="$icon" :size="16" /></button>
                                            </form>
                                        @endforeach
                                    @endif
                                    <a class="icon-button" href="{{ route('inventory.items.edit', [$character, $item]) }}" title="Editar" aria-label="Editar {{ $item->name }}"><x-icon name="pencil" :size="16" /></a>
                                    <button
                                        type="button"
                                        class="icon-button"
                                        title="Remover"
                                        aria-label="Remover {{ $item->name }}"
                                        data-modal-open="confirm-delete"
                                        data-modal-action="{{ route('inventory.items.destroy', [$character, $item]) }}"
                                        data-modal-text-name="{{ $item->name }}"
                                    ><x-icon name="trash" :size="16" /></button>
                                </span>
                            </div>
                        @endif
                    </article>
                @empty
                    <x-empty-state>Nenhum item nesta categoria.</x-empty-state>
                @endforelse
            </div>
        </section>
    </div>

    @if ($canEdit)
        <x-modal id="money" title="Gerenciar Dinheiro" :open-on-load="$errors->has('amount')">
            <form class="form" method="POST" action="{{ route('inventory.money', $character) }}">
                @csrf
                @method('PUT')
                <p class="muted">Saldo atual: {{ number_format($character->money, 0, ',', '.') }} MO</p>
                <x-form.field name="amount" label="Quantidade (MO)" type="number" min="1" required />
                <div class="modal__actions">
                    <button type="submit" name="operation" value="remove" class="button button--secondary">Retirar</button>
                    <button type="submit" name="operation" value="add" class="button button--gold">Adicionar</button>
                </div>
            </form>
        </x-modal>

        <x-catalog.delete-modal type="item" />

        {{-- Rolagem de dano numa janela, sem recarregar; a munição gasta é atualizada na lista. --}}
        <x-roll-dialog />

        @push('scripts')
            <script type="module" src="@asset('js/inventory/ammo.js')"></script>
        @endpush
    @endif
    {{-- Menu de ações: dados, chat da campanha (as rolagens também aparecem nele) e anotações. --}}
    <x-action-menu :session="$character->gameSession" :character="$character" />
</x-layouts.app>
