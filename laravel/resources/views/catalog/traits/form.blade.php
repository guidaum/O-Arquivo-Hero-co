@php
    $editing = $trait->exists;
    $targetOptions = ['' => 'Nenhum (só o efeito descrito)'];
    foreach ($attributes as $attribute) {
        $targetOptions['attr:'.strtolower($attribute['id'])] = 'Atributo · '.$attribute['label'];
    }
    foreach ($talents as $talent) {
        $targetOptions['talent:'.$talent->id] = 'Talento · '.$talent->name;
    }
@endphp

<x-layouts.app :title="($editing ? 'Editar' : 'Nova').' Vantagem/Defeito · Catálogos'">
    @include('catalog.partials.header', ['title' => 'Vantagens & Defeitos'])

    <form class="catalog-form glass" method="POST" action="{{ $editing ? route('catalog.traits.update', $trait) : route('catalog.traits.store') }}" data-trait-form>
        @csrf
        @if ($editing) @method('PUT') @endif
        @if ($suggestionId) <input type="hidden" name="suggestion_id" value="{{ $suggestionId }}"> @endif

        <h2 class="catalog-form__title">{{ $editing ? 'Editar Vantagem/Defeito' : ($suggestionId ? 'Revisar Sugestão de Vantagem/Defeito' : 'Nova Vantagem/Defeito') }}</h2>

        @if ($suggestionId)
            <p class="alert">Revise os dados sugeridos pelo jogador. Ao salvar, a sugestão é aprovada e entra na biblioteca.</p>
        @endif

        <div class="form-grid">
            <x-form.field name="name" label="Nome" :value="$trait->name" required maxlength="255" />
            <x-form.field name="type" label="Tipo" type="select" :value="$trait->type?->value" :options="['advantage' => 'Vantagem', 'disadvantage' => 'Defeito (desvantagem)']" required data-trait-type />
            <x-form.field name="target" label="Alvo do modificador" type="select" :value="$target" :options="$targetOptions" />
            <x-form.field name="modifier" label="Modificador" type="number" :value="$trait->modifier ?? 0" min="-100" max="100" required data-trait-modifier hint="O sinal é respeitado: use negativo para penalidades." />
        </div>

        <x-form.field name="effect" label="Efeito" type="textarea" :value="$trait->effect" maxlength="5000" placeholder="Ex.: +2 em Força, -1 em Agilidade" data-trait-effect />

        <div class="trait-cost glass" aria-live="polite">
            <span class="eyebrow">Custo calculado</span>
            <strong class="trait-cost__total" data-trait-cost>—</strong>
            <span class="muted" data-trait-cost-detail></span>
        </div>

        <x-form.field name="description" label="Descrição" type="textarea" :value="$trait->description" maxlength="5000" />

        <div class="form-actions">
            <a class="button button--secondary" href="{{ $suggestionId ? route('catalog.suggestions.index') : route('catalog.traits.index') }}">Cancelar</a>
            <button type="submit" class="button"><x-icon name="save" :size="16" /> {{ $suggestionId ? 'Aprovar e Adicionar' : ($editing ? 'Salvar' : 'Criar') }}</button>
        </div>
    </form>

    @push('scripts')
        <script type="module" src="{{ asset('js/catalog/trait-form.js') }}"></script>
    @endpush
</x-layouts.app>
