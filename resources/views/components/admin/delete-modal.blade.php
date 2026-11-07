@props(['type', 'warning' => ''])

{{--
    Confirmação de exclusão compartilhada pelas linhas da lista. O botão de cada
    linha usa data-modal-open="confirm-delete", data-modal-action (rota DELETE)
    e data-modal-text-name (nome exibido).
--}}
<x-modal id="confirm-delete" title="Confirmar Exclusão" danger>
    <div class="confirm-box">
        <div class="confirm-box__row">
            <span class="eyebrow">Tipo</span>
            <strong>{{ $type }}</strong>
        </div>
        <div class="confirm-box__row">
            <span class="eyebrow">Identificador</span>
            <strong data-modal-text="name"></strong>
        </div>
        <p>
            Tem certeza que deseja excluir este registro permanentemente? Esta é uma ação
            irreversível de administrador. {{ $warning }}
        </p>
    </div>

    <form class="modal__actions" method="POST" action="#" data-modal-form>
        @csrf
        @method('DELETE')

        <button type="button" class="button button--secondary" data-modal-close>Cancelar</button>
        <button type="submit" class="button button--danger">
            <x-icon name="trash" :size="16" />
            Sim, Excluir
        </button>
    </form>
</x-modal>
