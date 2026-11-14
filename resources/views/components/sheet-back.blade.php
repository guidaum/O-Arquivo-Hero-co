@props(['character' => null, 'id' => null, 'compact' => false])

@php
    // Personagem informado pela tela (model ou id), ou o "?ficha=" dos links que saem da ficha.
    $target = $character;
    $targetId = $id ?? request()->query('ficha');

    if ($target === null && is_numeric($targetId)) {
        $target = \App\Models\Character::query()->find((int) $targetId);
    }

    $show = $target !== null && auth()->user()?->can('view', $target);
@endphp

{{--
    "Voltar à ficha" nas telas abertas a partir da ficha do personagem
    (inventário, diário, mapas). compact: botão de ícone, para as barras dos mapas.
--}}
@if ($show)
    @if ($compact)
        <a {{ $attributes->class(['icon-button icon-button--bordered sheet-back']) }} href="{{ route('characters.show', $target) }}" title="Voltar à ficha de {{ $target->name }}" aria-label="Voltar à ficha de {{ $target->name }}">
            <x-icon name="arrow-left" :size="18" />
        </a>
    @else
        <a {{ $attributes->class(['page-header__back sheet-back']) }} href="{{ route('characters.show', $target) }}">
            <x-icon name="arrow-left" :size="16" />
            <span>Voltar à ficha de {{ $target->name }}</span>
        </a>
    @endif
@endif
