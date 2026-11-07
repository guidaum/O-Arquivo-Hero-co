@props(['title', 'subtitle' => null])

{{-- Cabeçalho de página: selos (slot "badges"), título, subtítulo e ações (slot "actions"). --}}
<header {{ $attributes->class(['page-header']) }}>
    <div>
        @isset($badges)
            <div class="page-header__badges">{{ $badges }}</div>
        @endisset

        <h1 class="page-header__title text-glow-arcane">{{ $title }}</h1>

        @if ($subtitle)
            <p class="page-header__subtitle">{{ $subtitle }}</p>
        @endif
    </div>

    @isset($actions)
        <div class="page-header__actions">{{ $actions }}</div>
    @endisset
</header>
