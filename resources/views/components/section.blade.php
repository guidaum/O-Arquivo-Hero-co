@props(['title', 'icon' => null, 'tone' => 'arcane'])

{{-- Seção de página com título e ícone. Slot "action" para um link à direita do título. --}}
<section {{ $attributes->class(['section', 'section--ember' => $tone === 'ember']) }}>
    <div class="section__header">
        <h2 class="section__title">
            @if ($icon)
                <x-icon :name="$icon" :size="24" />
            @endif
            {{ $title }}
        </h2>

        @isset($action)
            {{ $action }}
        @endisset
    </div>

    {{ $slot }}
</section>
