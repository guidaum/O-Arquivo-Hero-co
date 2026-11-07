@props([
    'name',
    'label',
    'type' => 'text',
    'value' => null,
    'bag' => 'default',
    'hint' => null,
    'options' => [],
])

{{-- type="select" usa $options (valor => rótulo); type="textarea" vira área de texto. --}}

@php
    $id = $attributes->get('id', 'field-'.$name);
    $error = $errors->getBag($bag)->first($name);
@endphp

<div class="field">
    <label class="field__label" for="{{ $id }}">{{ $label }}</label>

    @if ($type === 'select')
        <select
            id="{{ $id }}"
            name="{{ $name }}"
            @if ($error) aria-invalid="true" aria-describedby="{{ $id }}-error" @endif
            {{ $attributes->except('id')->merge(['class' => 'field__input']) }}
        >
            @foreach ($options as $optionValue => $optionLabel)
                <option value="{{ $optionValue }}" @selected((string) old($name, $value) === (string) $optionValue)>{{ $optionLabel }}</option>
            @endforeach
        </select>
    @elseif ($type === 'textarea')
        <textarea
            id="{{ $id }}"
            name="{{ $name }}"
            @if ($error) aria-invalid="true" aria-describedby="{{ $id }}-error" @endif
            {{ $attributes->except('id')->merge(['class' => 'field__input', 'rows' => 4]) }}
        >{{ old($name, $value) }}</textarea>
    @else
        <input
            id="{{ $id }}"
            name="{{ $name }}"
            type="{{ $type }}"
            @if ($type !== 'password' && $type !== 'file') value="{{ old($name, $value) }}" @endif
            @if ($error) aria-invalid="true" aria-describedby="{{ $id }}-error" @endif
            {{ $attributes->except('id')->merge(['class' => 'field__input']) }}
        >
    @endif

    @if ($hint)
        <p class="field__hint">{{ $hint }}</p>
    @endif

    @if ($error)
        <p class="field__error" id="{{ $id }}-error">{{ $error }}</p>
    @endif
</div>
