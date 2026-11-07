@php
    $editing = $power->exists;
@endphp

<x-layouts.app :title="($editing ? 'Editar' : 'Novo').' Poder · Catálogos'">
    @include('catalog.partials.header', ['title' => 'Biblioteca de Poderes'])

    <form class="catalog-form glass" method="POST" action="{{ $editing ? route('catalog.powers.update', $power) : route('catalog.powers.store') }}">
        @csrf
        @if ($editing) @method('PUT') @endif
        @if ($suggestionId) <input type="hidden" name="suggestion_id" value="{{ $suggestionId }}"> @endif

        <h2 class="catalog-form__title">{{ $editing ? 'Editar Poder' : ($suggestionId ? 'Revisar Sugestão de Poder' : 'Novo Poder') }}</h2>

        @if ($suggestionId)
            <p class="alert">Revise os dados sugeridos pelo jogador. Ao salvar, a sugestão é aprovada e o poder entra na biblioteca.</p>
        @endif

        <div class="form-grid">
            <x-form.field name="name" label="Nome" :value="$power->name" required maxlength="255" />
            <x-form.field name="type" label="Tipo" type="select" :value="$power->type" :options="array_combine($types, $types)" required />
            <x-form.field name="purchase_cost" label="Custo de compra (pontos)" type="number" :value="$power->purchase_cost ?? 0" min="0" max="1000" required />
            <x-form.field name="cost" label="Custo de uso" :value="$power->cost" maxlength="64" placeholder="Ex.: 3 ATP" />
            <x-form.field name="difficulty_formula" label="Fórmula de dificuldade" :value="$power->difficulty_formula" maxlength="255" placeholder="Ex.: 10 + INT" />
        </div>

        <x-form.field name="effect" label="Efeito" type="textarea" :value="$power->effect" maxlength="5000" />
        <x-form.field name="description" label="Descrição" type="textarea" :value="$power->description" maxlength="5000" />

        <div class="form-actions">
            <a class="button button--secondary" href="{{ $suggestionId ? route('catalog.suggestions.index') : route('catalog.powers.index') }}">Cancelar</a>
            <button type="submit" class="button"><x-icon name="save" :size="16" /> {{ $suggestionId ? 'Aprovar e Adicionar' : ($editing ? 'Salvar Poder' : 'Criar Poder') }}</button>
        </div>
    </form>
</x-layouts.app>
