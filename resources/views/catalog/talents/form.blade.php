@php
    $editing = $talent->exists;
    $composition = old('composition', $talent->composition ?? []);
    $attributeOptions = collect($attributes)->mapWithKeys(fn (array $attribute) => [strtolower($attribute['id']) => strtoupper($attribute['id']).' · '.$attribute['label']])->all();
@endphp

<x-layouts.app :title="($editing ? 'Editar' : 'Novo').' Talento · Catálogos'">
    @include('catalog.partials.form-header', ['title' => 'Biblioteca de Talentos', 'type' => 'talentos', 'form' => $form])

    <form class="catalog-form glass" method="POST" action="{{ $form['action'] }}">
        @csrf
        @if ($form['method'] === 'PUT') @method('PUT') @endif

        <h2 class="catalog-form__title">{{ $editing ? 'Editar Talento' : 'Novo Talento' }}</h2>

        <div class="form-grid">
            <x-form.field name="name" label="Nome" :value="$talent->name" required maxlength="255" />

            <div class="field">
                <label class="field__label" for="field-category">Categoria</label>
                <input class="field__input" id="field-category" name="category" list="talent-categories" value="{{ old('category', $talent->category) }}" maxlength="64" placeholder="Ex.: Combate">
                <datalist id="talent-categories">
                    @foreach ($categories as $option)
                        <option value="{{ $option }}"></option>
                    @endforeach
                </datalist>
                @error('category') <p class="field__error">{{ $message }}</p> @enderror
            </div>
        </div>

        <fieldset class="field">
            <legend class="field__label">Composição (atributos somados)</legend>

            <div class="repeater" data-repeater>
                <div class="repeater__rows" data-repeater-rows>
                    @foreach ($composition as $index => $attributeId)
                        <div class="repeater__row" data-repeater-row>
                            <select class="field__input" name="composition[]" aria-label="Atributo {{ $index + 1 }}">
                                @foreach ($attributeOptions as $value => $label)
                                    <option value="{{ $value }}" @selected(strtolower((string) $attributeId) === $value)>{{ $label }}</option>
                                @endforeach
                            </select>
                            <button type="button" class="icon-button" data-repeater-remove aria-label="Remover atributo"><x-icon name="x" :size="16" /></button>
                        </div>
                    @endforeach
                </div>

                <template data-repeater-template>
                    <div class="repeater__row" data-repeater-row>
                        <select class="field__input" name="composition[]" aria-label="Atributo">
                            @foreach ($attributeOptions as $value => $label)
                                <option value="{{ $value }}">{{ $label }}</option>
                            @endforeach
                        </select>
                        <button type="button" class="icon-button" data-repeater-remove aria-label="Remover atributo"><x-icon name="x" :size="16" /></button>
                    </div>
                </template>

                <button type="button" class="button button--secondary" data-repeater-add><x-icon name="plus" :size="16" /> Adicionar atributo</button>
            </div>

            @error('composition') <p class="field__error">{{ $message }}</p> @enderror
            @error('composition.*') <p class="field__error">{{ $message }}</p> @enderror
        </fieldset>

        <x-form.field name="description" label="Descrição" type="textarea" :value="$talent->description" maxlength="5000" />

        <div class="form-actions">
            <a class="button button--secondary" href="{{ $form['cancel'] }}">Cancelar</a>
            <button type="submit" class="button"><x-icon name="save" :size="16" /> {{ $editing ? 'Salvar Talento' : 'Criar Talento' }}</button>
        </div>
    </form>

    @push('scripts')
        <script type="module" src="@asset('js/core/repeater.js')"></script>
    @endpush
</x-layouts.app>
