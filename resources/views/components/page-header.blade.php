@props(['title', 'subtitle' => null, 'back' => null, 'backLabel' => 'Voltar'])

{{--
    Cabeçalho de página: link de volta (back + backLabel), selos (slot
    "badges"), título, subtítulo e ações (slot "actions"). O link de volta
    fica sempre no mesmo lugar, acima do título, e libera as ações para o
    que a página faz.
--}}
<header {{ $attributes->class(['page-header']) }}>
    <div class="page-header__main">
        @if ($back)
            <a class="page-header__back" href="{{ $back }}">
                <x-icon name="arrow-left" :size="16" />
                <span>{{ $backLabel }}</span>
            </a>
        @endif

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
