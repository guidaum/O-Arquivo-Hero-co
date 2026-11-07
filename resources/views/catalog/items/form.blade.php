@php
    $editing = $item->exists;
    $stats = old('stats', (array) $item->stats);
    $selectedRelated = array_map('intval', old('related', $related));
@endphp

<x-layouts.app :title="($editing ? 'Editar' : 'Novo').' Item · Catálogos'">
    @include('catalog.partials.header', ['title' => 'Catálogo Global de Itens'])

    <form class="catalog-form glass" method="POST" enctype="multipart/form-data" action="{{ $editing ? route('catalog.items.update', $item) : route('catalog.items.store') }}">
        @csrf
        @if ($editing) @method('PUT') @endif

        <h2 class="catalog-form__title">{{ $editing ? 'Editar Item' : 'Novo Item' }}</h2>

        <div class="form-grid">
            <x-form.field name="name" label="Nome" :value="$item->name" required maxlength="255" />
            <x-form.field name="category" label="Categoria" type="select" :value="$item->category" :options="\App\Models\CatalogItem::CATEGORIES" required />
            <x-form.field name="rarity" label="Raridade" type="select" :value="$item->rarity" :options="\App\Models\CatalogItem::RARITIES" required />
            <x-form.field name="value" label="Valor (MO)" type="number" :value="$item->value ?? 0" min="0" required />
            <x-form.field name="weight" label="Peso (kg)" type="number" :value="$item->weight ?? 0" min="0" step="0.01" required />
            <x-form.field name="damage" label="Dano" :value="$item->damage" maxlength="64" placeholder="Ex.: 1D8 + FOR" />
            <x-form.field name="defense" label="Defesa" type="number" :value="$item->defense ?? 0" min="0" max="1000" required />
            <x-form.field name="bonus_text" label="Bônus (texto livre)" :value="$item->bonus_text" maxlength="255" />
        </div>

        <label class="checkbox">
            <input type="hidden" name="is_starting_item" value="0">
            <input type="checkbox" name="is_starting_item" value="1" @checked(old('is_starting_item', $item->is_starting_item))>
            Disponível no equipamento inicial da criação de personagem
        </label>

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
            @error('stats.*') <p class="field__error">{{ $message }}</p> @enderror
        </fieldset>

        <div class="form-grid">
            <div class="field">
                <label class="field__label" for="field-image">Imagem</label>
                @if ($item->image_url)
                    <img class="item-preview" src="{{ $item->image_url }}" alt="Imagem atual" referrerpolicy="no-referrer">
                    <label class="checkbox">
                        <input type="hidden" name="remove_image" value="0">
                        <input type="checkbox" name="remove_image" value="1"> Remover imagem atual
                    </label>
                @endif
                <input class="field__input" id="field-image" type="file" name="image" accept="image/jpeg,image/png,image/webp">
                <p class="field__hint">JPG, PNG ou WEBP, até 2 MB.</p>
                @error('image') <p class="field__error">{{ $message }}</p> @enderror
            </div>

            @if ($weapons->isNotEmpty())
                <fieldset class="field">
                    <legend class="field__label">Armas compatíveis (só para munição)</legend>
                    <div class="check-list">
                        @foreach ($weapons as $weapon)
                            <label class="checkbox">
                                <input type="checkbox" name="related[]" value="{{ $weapon->id }}" @checked(in_array($weapon->id, $selectedRelated, true))>
                                {{ $weapon->name }}
                            </label>
                        @endforeach
                    </div>
                    @error('related.*') <p class="field__error">{{ $message }}</p> @enderror
                </fieldset>
            @endif
        </div>

        <x-form.field name="description" label="Descrição" type="textarea" :value="$item->description" maxlength="5000" />

        <div class="form-actions">
            <a class="button button--secondary" href="{{ route('catalog.items.index') }}">Cancelar</a>
            <button type="submit" class="button"><x-icon name="save" :size="16" /> {{ $editing ? 'Salvar Item' : 'Criar Item' }}</button>
        </div>
    </form>
</x-layouts.app>
