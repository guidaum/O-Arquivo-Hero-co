@props(['prefix'])

{{-- Erros de uma lista editável (ex.: attributes.0.id, attributes.1.label). --}}
@php
    $messages = collect($errors->getMessages())
        ->filter(fn (array $messages, string $key) => $key === $prefix || str_starts_with($key, $prefix.'.'))
        ->flatten()
        ->unique();
@endphp

@foreach ($messages as $message)
    <p class="field__error">{{ $message }}</p>
@endforeach
