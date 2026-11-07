@props(['name', 'size' => 20])

{{-- Ícone do sprite public/images/icons.svg. Decorativo por padrão (aria-hidden). --}}
<svg
    {{ $attributes->merge(['class' => 'icon']) }}
    width="{{ $size }}"
    height="{{ $size }}"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
><use href="{{ asset('images/icons.svg') }}#{{ $name }}"></use></svg>
