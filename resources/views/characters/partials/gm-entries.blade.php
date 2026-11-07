{{-- Modificadores do mestre de um atributo ou talento; o mestre pode removê-los. --}}
@foreach ($entries as $entry)
    <p class="composition__note">
        Mestre {{ ((int) ($entry['value'] ?? 0)) > 0 ? '+'.(int) $entry['value'] : (int) ($entry['value'] ?? 0) }}:
        {{ $entry['justification'] ?? '' }}
        @if (! empty($entry['author_name'])) <small>— {{ $entry['author_name'] }}</small> @endif

        @if ($isGm && ! empty($entry['id']))
            <button
                type="button"
                class="composition__remove"
                title="Remover modificador do mestre"
                aria-label="Remover modificador do mestre"
                data-modal-open="confirm-delete"
                data-modal-action="{{ route('characters.gm-modifiers.destroy', [$character, $entry['id']]) }}"
                data-modal-text-name="o modificador do mestre ({{ $entry['justification'] ?? '' }})"
            ><x-icon name="x" :size="12" /></button>
        @endif
    </p>
@endforeach
