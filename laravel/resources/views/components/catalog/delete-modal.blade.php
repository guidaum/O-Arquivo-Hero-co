@props(['type', 'warning' => ''])

{{-- Confirmação de exclusão das bibliotecas (preenchida pelo botão de cada linha). --}}
<x-modal id="confirm-delete" :title="'Excluir '.$type.'?'" danger>
    <p class="muted">
        Tem certeza que deseja excluir <strong data-modal-text="name"></strong>?
        Esta ação não pode ser desfeita. {{ $warning }}
    </p>

    <form class="modal__actions" method="POST" action="#" data-modal-form>
        @csrf
        @method('DELETE')

        <button type="button" class="button button--secondary" data-modal-close>Cancelar</button>
        <button type="submit" class="button button--danger">
            <x-icon name="trash" :size="16" />
            Excluir
        </button>
    </form>
</x-modal>
