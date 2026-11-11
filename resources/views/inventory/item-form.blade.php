@php
    $editing = $item->exists;
    $stats = old('stats', (array) $item->stats);
    $categories = array_diff_key(\App\Models\CatalogItem::CATEGORIES, ['Geral' => true]);
@endphp

<x-layouts.app :title="($editing ? 'Editar' : 'Novo').' Item · Inventário'">
    @push('styles')
        <link rel="stylesheet" href="@asset('css/catalog.css')">
    @endpush

    <x-page-header :title="$editing ? 'Editar Item' : 'Adicionar Item Personalizado'" :subtitle="'Inventário de '.$character->name" :back="route('inventory.show', [$character, 'categoria' => $item->categoryKey()])" back-label="Voltar ao Inventário" />

    <form class="catalog-form glass" method="POST" enctype="multipart/form-data" action="{{ $editing ? route('inventory.items.update', [$character, $item]) : route('inventory.items.store', $character) }}">
        @csrf
        @if ($editing) @method('PUT') @endif

        <div class="form-grid">
            <x-form.field name="name" label="Nome" :value="$item->name" required maxlength="255" />
            <x-form.field name="category" label="Categoria" type="select" :value="$item->categoryKey()" :options="$categories" required />
            <x-form.field name="rarity" label="Raridade" type="select" :value="$item->rarityKey()" :options="\App\Models\CatalogItem::RARITIES" required />
            <x-form.field name="quantity" label="Quantidade" type="number" :value="$item->quantity ?? 1" min="1" required hint="Munição e consumíveis com o mesmo nome se acumulam." />
            <x-form.field name="weight" label="Peso (kg)" type="number" step="0.01" :value="$item->weight ?? 0" min="0" required />
            <x-form.field name="value" label="Valor (MO)" type="number" :value="$item->value ?? 0" min="0" required />
            <x-form.field name="damage" label="Dano" :value="$item->damage" maxlength="64" placeholder="Ex.: 1D8 + FOR" hint="Fórmula rolada pelo botão Rolar dano." />
            <x-form.field name="defense" label="Defesa" type="number" :value="$item->defense ?? 0" min="0" max="1000" required />
        </div>

        <fieldset class="field">
            <legend class="field__label">Bônus em atributos (quando equipado)</legend>
            <div class="stat-inputs">
                @foreach ($attributes as $attribute)
                    @php($attributeId = strtolower($attribute['id']))
                    <label class="stat-input">
                        <span>{{ strtoupper($attribute['id']) }}</span>
                        <input class="field__input" type="number" name="stats[{{ $attributeId }}]" value="{{ $stats[$attributeId] ?? '' }}" min="-100" max="100" placeholder="0" aria-label="Bônus em {{ $attribute['label'] }}">
                    </label>
                @endforeach
            </div>
        </fieldset>

        <div class="field">
            <label class="field__label" for="field-image">Imagem</label>
            @if ($item->image_url)
                <img class="item-preview" src="{{ $item->image_url }}" alt="Imagem atual" referrerpolicy="no-referrer">
                <label class="checkbox">
                    <input type="hidden" name="remove_image" value="0">
                    <input type="checkbox" name="remove_image" value="1"> Remover imagem atual
                </label>
            @endif
            <input class="field__input" id="field-image" type="file" name="image" accept="image/jpeg,image/png,image/webp,image/gif">
            @error('image') <p class="field__error">{{ $message }}</p> @enderror
        </div>

        <x-form.field name="description" label="Descrição" type="textarea" :value="$item->description" maxlength="5000" />

        <div class="form-actions">
            <a class="button button--secondary" href="{{ route('inventory.show', [$character, 'categoria' => $item->categoryKey()]) }}">Cancelar</a>
            <button type="submit" class="button"><x-icon name="save" :size="16" /> {{ $editing ? 'Salvar Item' : 'Adicionar Item' }}</button>
        </div>
    </form>
</x-layouts.app>
