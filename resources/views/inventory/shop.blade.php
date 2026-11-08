<x-layouts.app :title="'Loja · '.$character->name">
    @push('styles')
        <link rel="stylesheet" href="@asset('css/catalog.css')">
        <link rel="stylesheet" href="@asset('css/inventory.css')">
    @endpush

    <x-page-header title="Loja do Mercador" :subtitle="'Comprando para '.$character->name">
        <x-slot:actions>
            <span class="inventory-stat glass">
                <span class="inventory-stat__icon inventory-stat__icon--gold"><x-icon name="coins" :size="20" /></span>
                <span>
                    <span class="eyebrow">Sua bolsa</span>
                    <span class="inventory-stat__value">{{ number_format($character->money, 0, ',', '.') }} <small>MO</small></span>
                </span>
            </span>
            <a class="button button--secondary button--pill" href="{{ route('inventory.show', $character) }}">Voltar ao Inventário</a>
        </x-slot:actions>
    </x-page-header>

    @error('purchase')
        <div class="alert alert--error" role="alert">{{ $message }}</div>
    @enderror

    <x-search-bar :search="$search" placeholder="Buscar na loja...">
        <label class="inline-form">
            <span class="visually-hidden">Categoria</span>
            <select class="select" name="categoria" data-autosubmit>
                <option value="">Todas as categorias</option>
                @foreach (array_diff_key(\App\Models\CatalogItem::CATEGORIES, ['Geral' => true]) as $value => $label)
                    <option value="{{ $value }}" @selected($category === $value)>{{ $label }}</option>
                @endforeach
            </select>
        </label>
    </x-search-bar>

    <div class="item-grid">
        @forelse ($items as $item)
            @php($stackable = in_array($item->category, \App\Models\CatalogItem::STACKABLE_CATEGORIES, true))
            <article class="item-card glass rarity-border--{{ strtolower(\App\Models\CatalogItem::normalizeRarity($item->rarity)) }}">
                <div class="item-card__top">
                    <span class="item-card__image">
                        @if ($item->image_url)
                            <img src="{{ $item->image_url }}" alt="" loading="lazy" referrerpolicy="no-referrer">
                        @else
                            <x-icon name="backpack" :size="26" />
                        @endif
                    </span>
                    <div class="item-card__heading">
                        <h3 class="item-card__name">{{ $item->name }}</h3>
                        <div class="item-card__badges">
                            <span class="badge badge--pill">{{ $item->categoryLabel() }}</span>
                            <span class="badge badge--pill rarity rarity--{{ strtolower(\App\Models\CatalogItem::normalizeRarity($item->rarity)) }}">{{ $item->rarityLabel() }}</span>
                        </div>
                    </div>
                </div>

                @if ($item->description)
                    <p class="item-card__description">{{ \Illuminate\Support\Str::limit($item->description, 160) }}</p>
                @endif

                <dl class="item-card__stats">
                    @if ($item->damage) <div><dt>Dano</dt><dd>{{ $item->damage }}</dd></div> @endif
                    @if ($item->defense) <div><dt>Defesa</dt><dd>+{{ $item->defense }}</dd></div> @endif
                    <div><dt>Peso</dt><dd>{{ rtrim(rtrim(number_format((float) $item->weight, 2, ',', '.'), '0'), ',') ?: '0' }} kg</dd></div>
                </dl>

                <form class="item-card__actions" method="POST" action="{{ route('inventory.shop.purchase', [$character, $item]) }}">
                    @csrf
                    <span class="item-card__price">{{ number_format((int) $item->value, 0, ',', '.') }} MO{{ $stackable ? ' / un.' : '' }}</span>
                    @if ($stackable)
                        <label class="visually-hidden" for="qty-{{ $item->id }}">Quantidade</label>
                        <input class="field__input item-card__qty" id="qty-{{ $item->id }}" type="number" name="quantity" value="1" min="1" max="1000">
                    @endif
                    <button type="submit" class="button button--gold"><x-icon name="coins" :size="16" /> Comprar</button>
                </form>
            </article>
        @empty
            <x-empty-state>O mercador não tem nada para vender agora.</x-empty-state>
        @endforelse
    </div>

    {{ $items->links() }}
</x-layouts.app>
