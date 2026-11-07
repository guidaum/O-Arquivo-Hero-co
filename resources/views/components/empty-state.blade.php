{{-- Aviso de lista vazia, ocupando a linha inteira da grade. --}}
<div {{ $attributes->class(['empty-state']) }}>
    <p>{{ $slot }}</p>
</div>
