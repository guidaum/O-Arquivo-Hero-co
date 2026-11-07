<x-layouts.app title="Itens · Catálogos">
    @include('catalog.partials.header', ['title' => 'Catálogo Global de Itens'])

    <x-search-bar :search="$search" placeholder="Buscar itens...">
        <label class="inline-form">
            <span class="visually-hidden">Categoria</span>
            <select class="select" name="categoria" data-autosubmit>
                <option value="">Todas as categorias</option>
                @foreach (\App\Models\CatalogItem::CATEGORIES as $value => $label)
                    <option value="{{ $value }}" @selected($category === $value)>{{ $label }}</option>
                @endforeach
            </select>
        </label>

        <x-slot:actions>
            <a class="button" href="{{ route('catalog.items.create') }}"><x-icon name="plus" :size="16" /> Novo Item</a>
        </x-slot:actions>
    </x-search-bar>

    <div class="row-list">
        @forelse ($items as $item)
            <article class="row-card glass">
                <div class="row-card__main">
                    <span class="row-card__media">
                        @if ($item->image_url)
                            <img src="{{ $item->image_url }}" alt="" loading="lazy" referrerpolicy="no-referrer">
                        @else
                            <x-icon name="backpack" :size="22" />
                        @endif
                    </span>
                    <div>
                        <h3 class="row-card__title">
                            {{ $item->name }}
                            <span class="badge badge--pill">{{ $item->categoryLabel() }}</span>
                            <span class="badge badge--pill rarity rarity--{{ strtolower((string) ($item->rarity ?: 'common')) }}">{{ $item->rarityLabel() }}</span>
                            @if ($item->is_starting_item)
                                <span class="badge badge--pill badge--gm" title="Disponível no equipamento inicial">Inicial</span>
                            @endif
                        </h3>
                        <p class="row-card__meta">
                            <span>{{ number_format((int) $item->value, 0, ',', '.') }} MO</span>
                            <span>{{ rtrim(rtrim(number_format((float) $item->weight, 2, ',', '.'), '0'), ',') }} kg</span>
                            @if ($item->damage) <span>Dano {{ $item->damage }}</span> @endif
                            @if ($item->defense) <span>Defesa +{{ $item->defense }}</span> @endif
                            @foreach ((array) $item->stats as $attribute => $bonus)
                                <span>{{ strtoupper($attribute) }} {{ $bonus > 0 ? '+'.$bonus : $bonus }}</span>
                            @endforeach
                        </p>
                    </div>
                </div>

                <div class="row-card__actions">
                    <form method="POST" action="{{ route('catalog.items.duplicate', $item) }}">
                        @csrf
                        <button type="submit" class="icon-button icon-button--bordered" title="Duplicar" aria-label="Duplicar {{ $item->name }}"><x-icon name="copy" :size="18" /></button>
                    </form>
                    <a class="icon-button icon-button--bordered" href="{{ route('catalog.items.edit', $item) }}" title="Editar" aria-label="Editar {{ $item->name }}"><x-icon name="pencil" :size="18" /></a>
                    <x-catalog.delete-button :action="route('catalog.items.destroy', $item)" :name="$item->name" />
                </div>
            </article>
        @empty
            <x-empty-state>Nenhum item encontrado no catálogo.</x-empty-state>
        @endforelse
    </div>

    {{ $items->links() }}

    <x-catalog.delete-modal type="item" warning="Itens já guardados nos inventários dos personagens continuam com eles." />
</x-layouts.app>
