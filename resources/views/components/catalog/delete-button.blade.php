@props(['action', 'name'])

{{-- Botão de excluir de uma linha; abre a confirmação <x-catalog.delete-modal>. --}}
<button
    type="button"
    class="icon-button icon-button--danger"
    title="Excluir"
    aria-label="Excluir {{ $name }}"
    data-modal-open="confirm-delete"
    data-modal-action="{{ $action }}"
    data-modal-text-name="{{ $name }}"
>
    <x-icon name="trash" :size="18" />
</button>
