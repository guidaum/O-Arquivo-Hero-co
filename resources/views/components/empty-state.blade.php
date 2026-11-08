@props(['icon' => null, 'hint' => null])

{{--
    Aviso de lista vazia, ocupando a linha inteira da grade. Opcionais: ícone,
    dica (o que fazer a seguir) e o slot "action" com o botão do próximo passo.
--}}
<div {{ $attributes->class(['empty-state', 'empty-state--guided' => $icon || $hint || isset($action)]) }}>
    @if ($icon)
        <span class="empty-state__icon" aria-hidden="true"><x-icon :name="$icon" :size="28" /></span>
    @endif

    <p>{{ $slot }}</p>

    @if ($hint)
        <p class="empty-state__hint">{{ $hint }}</p>
    @endif

    @isset($action)
        <div class="empty-state__action">{{ $action }}</div>
    @endisset
</div>
