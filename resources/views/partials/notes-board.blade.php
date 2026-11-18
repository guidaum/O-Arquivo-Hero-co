{{--
    Quadro de anotações rápidas (busca, categorias, fixar, editar, excluir),
    desenhado por public/js/gm-screen/notes.js dentro de um
    [data-screen-pane="anotacoes"]. Usado no Escudo do Mestre e no painel do
    Modo TV da masmorra. Estilos em gm-screen.css (.screen-*).
--}}
<div class="screen-toolbar">
    <label class="search-field">
        <x-icon name="search" :size="16" />
        <span class="visually-hidden">Buscar anotações</span>
        <input class="field__input" type="search" placeholder="Buscar anotações..." data-notes-search>
    </label>
    <button type="button" class="button" data-notes-new><x-icon name="plus" :size="16" /> Nova anotação</button>
</div>
<div class="chips" role="group" aria-label="Filtrar por categoria" data-notes-filter></div>

<form class="screen-editor glass" data-notes-form hidden>
    <input class="field__input" name="title" maxlength="255" placeholder="Título (ex.: Taverna do Corvo)" aria-label="Título">
    <textarea class="field__input" name="content" rows="5" maxlength="5000" placeholder="Ganchos, nomes, segredos, tesouros..." aria-label="Texto"></textarea>
    <div class="chips" role="radiogroup" aria-label="Categoria" data-notes-category></div>
    <div class="screen-editor__actions">
        <button type="button" class="button button--secondary" data-notes-cancel>Cancelar</button>
        <button type="submit" class="button"><x-icon name="save" :size="16" /> Salvar</button>
    </div>
</form>

<ul class="screen-notes" data-notes-list aria-live="polite"></ul>
<p class="muted screen-pane__empty" data-notes-empty hidden></p>
