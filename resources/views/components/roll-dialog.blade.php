{{--
    Janela de rolagem: formulários com data-roll-dialog (testes F/N/D/E da
    ficha, dano de itens no inventário) são enviados por fetch e o resultado
    aparece aqui, sem recarregar a página (public/js/tools/roll-dialog.js).
    A rota responde em JSON com result: {title, label, value, outcome, detail, note}.
    Sem JavaScript, o formulário continua sendo enviado normalmente.
--}}
<x-modal id="roll-dialog" title="Rolagem" class="roll-dialog" data-roll-dialog-modal>
    <div class="roll-dialog__body" data-roll-body aria-live="polite">
        <span class="roll-dialog__die" data-roll-value aria-hidden="true">?</span>
        <p class="eyebrow" data-roll-label></p>
        <p class="roll-dialog__outcome" data-roll-outcome>Rolando...</p>
        <p class="muted roll-dialog__detail" data-roll-detail></p>
        <p class="roll-dialog__note" data-roll-note hidden></p>
        <p class="alert alert--error" data-roll-error role="alert" hidden></p>
    </div>
    <div class="modal__actions">
        <button type="button" class="button button--secondary" data-modal-close>Fechar</button>
        <button type="button" class="button" data-roll-again><x-icon name="dice" :size="16" /> Rolar de novo</button>
    </div>
</x-modal>

@pushOnce('scripts')
    <script type="module" src="@asset('js/tools/roll-dialog.js')"></script>
@endPushOnce
