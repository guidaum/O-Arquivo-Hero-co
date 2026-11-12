@php
    $editing = $skill->exists;
@endphp

<x-layouts.app :title="($editing ? 'Editar' : 'Nova').' Perícia · Catálogos'">
    @include('catalog.partials.form-header', ['title' => 'Biblioteca de Perícias', 'type' => 'pericias', 'form' => $form])

    <form class="catalog-form glass" method="POST" action="{{ $form['action'] }}">
        @csrf
        @if ($form['method'] === 'PUT') @method('PUT') @endif
        @if ($suggestionId) <input type="hidden" name="suggestion_id" value="{{ $suggestionId }}"> @endif

        <h2 class="catalog-form__title">{{ $editing ? 'Editar Perícia' : ($suggestionId ? 'Revisar Sugestão de Perícia' : 'Nova Perícia') }}</h2>

        @if ($suggestionId)
            <p class="alert">Revise os dados sugeridos pelo jogador. Ao salvar, a sugestão é aprovada e a perícia entra na biblioteca.</p>
        @endif

        <div class="form-grid">
            <x-form.field name="name" label="Nome" :value="$skill->name" required maxlength="255" />
            <x-form.field name="type" label="Tipo" type="select" :value="$skill->type" :options="array_combine($types, $types)" required />
            <x-form.field name="purchase_cost" label="Custo de compra (pontos)" type="number" :value="$skill->purchase_cost ?? 0" min="0" max="1000" required />
            <x-form.field name="atp_cost" label="Custo de ATP" type="number" :value="$skill->atp_cost ?? 0" min="0" max="1000" required />
            <x-form.field name="damage" label="Dano" :value="$skill->damage" maxlength="64" placeholder="Ex.: 1D6 + FOR" />
            <x-form.field name="difficulty_formula" label="Fórmula de dificuldade" :value="$skill->difficulty_formula" maxlength="255" placeholder="Ex.: 10 + INT" hint="Variáveis: atributos (FOR, AGI...), LUTA, MISTICA, SKILLS..." />
        </div>

        <x-form.field name="description" label="Descrição" type="textarea" :value="$skill->description" maxlength="5000" />

        <div class="form-actions">
            <a class="button button--secondary" href="{{ $suggestionId ? route('admin.suggestions.index', ['origem' => 'jogadores']) : $form['cancel'] }}">Cancelar</a>
            <button type="submit" class="button"><x-icon name="save" :size="16" /> {{ $suggestionId ? 'Aprovar e Adicionar' : ($editing ? 'Salvar Perícia' : 'Criar Perícia') }}</button>
        </div>
    </form>
</x-layouts.app>
