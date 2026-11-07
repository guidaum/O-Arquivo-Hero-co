@props(['id', 'title', 'wide' => false, 'danger' => false, 'openOnLoad' => false])

{{--
    Janela modal (<dialog> nativo). Abre com um botão data-modal-open="{id}"
    e fecha com data-modal-close, Esc ou clique fora (public/js/core/layout.js).
    Use open-on-load para reabrir a janela quando o formulário voltar com erros.
--}}
<dialog
    id="{{ $id }}"
    aria-labelledby="{{ $id }}-title"
    @if ($openOnLoad) data-modal-open-on-load @endif
    {{ $attributes->class(['modal', 'modal--wide' => $wide, 'modal--danger' => $danger]) }}
>
    <div class="modal__header">
        <h2 class="modal__title" id="{{ $id }}-title">{{ $title }}</h2>

        <button type="button" class="icon-button" data-modal-close aria-label="Fechar">
            <x-icon name="x" />
        </button>
    </div>

    {{ $slot }}

    @isset($actions)
        <div class="modal__actions">{{ $actions }}</div>
    @endisset
</dialog>
