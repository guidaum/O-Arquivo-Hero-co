@props(['search' => '', 'placeholder' => 'Buscar...'])

{{-- Busca da lista (GET, mantém os filtros na URL). O slot recebe filtros extras; o slot "actions", botões à direita. --}}
<form class="toolbar" method="GET" action="{{ url()->current() }}" role="search">
    <label class="search-field">
        <span class="visually-hidden">Buscar</span>
        <x-icon name="search" :size="18" />
        <input class="field__input" type="search" name="busca" value="{{ $search }}" placeholder="{{ $placeholder }}">
    </label>

    {{ $slot }}

    <button type="submit" class="button button--secondary">
        <x-icon name="search" :size="16" />
        Buscar
    </button>

    @isset($actions)
        <div class="toolbar__actions">{{ $actions }}</div>
    @endisset
</form>
