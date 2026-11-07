// Anotações Rápidas (QuickNotes.tsx). Ficam no servidor: do personagem
// (dono ou mestre) e da campanha (só o mestre). Com os dois escopos, o
// mestre alterna entre eles, como no sistema antigo.

import { deleteJson, getJson, postJson, request } from '../core/http.js';
import { el, icon, replace } from '../core/dom.js';

const panel = document.querySelector('[data-notes]');

if (panel) {
    const config = JSON.parse(panel.dataset.config);
    const scopes = config.scopes;
    const categories = config.categories;
    const $ = (selector) => panel.querySelector(selector);
    const form = $('[data-notes-form]');
    const error = $('[data-notes-error]');

    const state = {
        open: false,
        scope: Object.keys(scopes)[0],
        notes: [],
        loaded: null,
        tab: 'all',
        search: '',
        editing: null,
        category: 'general',
    };

    const scope = () => scopes[state.scope];
    const normalize = (text) => String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

    // Abrir e fechar (menu de ações)

    function setOpen(open) {
        state.open = open;
        panel.hidden = !open;
        document.dispatchEvent(new CustomEvent('tool:state', { detail: { tool: 'notes', open } }));

        if (open && state.loaded !== state.scope) load();
    }

    document.addEventListener('tool:toggle', (event) => {
        if (event.detail?.tool === 'notes') setOpen(event.detail.open ?? !state.open);
    });
    document.addEventListener('tool:state', (event) => {
        if (event.detail?.tool !== 'notes' && event.detail?.open && state.open) setOpen(false);
    });

    // Dados

    async function load() {
        replace($('[data-notes-list]'), el('li', { class: 'notes-list__empty' }, 'Carregando...'));

        try {
            const body = await getJson(scope().url);
            state.notes = body.notes ?? [];
            state.loaded = state.scope;
            render();
        } catch (failure) {
            replace($('[data-notes-list]'), el('li', { class: 'notes-list__empty' }, failure.message));
        }
    }

    function sortNotes() {
        state.notes.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.id - a.id);
    }

    function copyText(note) {
        const prefix = state.scope === 'campaign' ? `[Campanha: ${scope().name}]` : `[Personagem: ${scope().name}]`;

        return `${prefix} [${note.title}] (${(categories[note.category] ?? note.category).toUpperCase()})\n${note.content}`;
    }

    function copyAllText() {
        const header = state.scope === 'campaign' ? `=== Anotações da Campanha: ${scope().name} ===` : `=== Anotações de ${scope().name} ===`;

        return `${header}\n\n${state.notes.map((note) => `• [${note.title}] (${(categories[note.category] ?? note.category).toUpperCase()} - ${note.created_at})\n${note.content}`).join('\n\n')}`;
    }

    // Tela

    function render() {
        $('[data-notes-target]').textContent = `${scope().label}: ${scope().name}`;
        panel.querySelectorAll('[data-notes-scope]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.notesScope === state.scope)));

        replace($('[data-notes-tabs]'), [['all', 'Todas'], ...Object.entries(categories)].map(([key, label]) => {
            const count = key === 'all' ? state.notes.length : state.notes.filter((note) => note.category === key).length;

            return el('button', {
                type: 'button',
                class: `chip notes-tab notes-tab--${key}${state.tab === key ? ' is-active' : ''}`,
                'aria-pressed': String(state.tab === key),
                onClick: () => { state.tab = key; render(); },
            }, label, count ? el('small', {}, ` ${count}`) : null);
        }));

        const term = normalize(state.search);
        const list = state.notes.filter((note) => (state.tab === 'all' || note.category === state.tab)
            && (!term || normalize(`${note.title} ${note.content}`).includes(term)));

        replace($('[data-notes-list]'), list.length === 0
            ? el('li', { class: 'notes-list__empty' }, state.notes.length ? 'Nenhuma anotação encontrada.' : 'Nenhuma anotação ainda. Clique em "Nova" para começar.')
            : list.map((note) => el('li', { class: `note-card note-card--${note.category}${note.pinned ? ' is-pinned' : ''}` },
                el('header', { class: 'note-card__header' },
                    el('span', { class: `chip notes-tab--${note.category}` }, categories[note.category] ?? note.category),
                    el('strong', { class: 'note-card__title' }, note.title),
                    el('time', {}, note.created_at)),
                note.content ? el('p', { class: 'note-card__content' }, note.content) : null,
                el('div', { class: 'note-card__actions' },
                    el('button', { type: 'button', class: `icon-button${note.pinned ? ' is-active' : ''}`, title: note.pinned ? 'Desafixar' : 'Fixar no topo', 'aria-pressed': String(note.pinned), onClick: () => togglePin(note) }, icon('pin', 15)),
                    el('button', { type: 'button', class: 'icon-button', title: 'Editar', onClick: () => startEdit(note) }, icon('pencil', 15)),
                    el('button', { type: 'button', class: 'icon-button', title: 'Copiar', 'data-copy': copyText(note) }, icon('copy', 15)),
                    el('button', { type: 'button', class: 'icon-button', title: 'Excluir', onClick: () => remove(note) }, icon('trash', 15))))));

        $('[data-notes-copy-all]').dataset.copy = copyAllText();
        $('[data-notes-copy-all]').disabled = state.notes.length === 0;
        $('[data-notes-clear]').disabled = state.notes.length === 0;
    }

    function renderCategoryPicker() {
        replace($('[data-notes-category]'), Object.entries(categories).map(([key, label]) => el('button', {
            type: 'button',
            class: `chip notes-tab--${key}${state.category === key ? ' is-active' : ''}`,
            'aria-pressed': String(state.category === key),
            onClick: () => { state.category = key; renderCategoryPicker(); },
        }, label)));
    }

    // Edição

    function openEditor(note = null) {
        state.editing = note;
        state.category = note?.category ?? 'general';
        form.elements.title.value = note?.title ?? '';
        form.elements.content.value = note?.content ?? '';
        error.textContent = '';
        form.hidden = false;
        renderCategoryPicker();
        form.elements.content.focus();
    }

    function closeEditor() {
        state.editing = null;
        form.hidden = true;
        form.reset();
    }

    function startEdit(note) {
        openEditor(note);
    }

    $('[data-notes-new]').addEventListener('click', () => openEditor());
    $('[data-notes-cancel]').addEventListener('click', closeEditor);

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const data = { title: form.elements.title.value, content: form.elements.content.value, category: state.category };
        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;

        try {
            if (state.editing) {
                const body = await request(`${scope().url}/${state.editing.id}`, { method: 'PUT', data });
                state.notes = state.notes.map((note) => (note.id === body.note.id ? body.note : note));
            } else {
                const body = await postJson(scope().url, data);
                state.notes.unshift(body.note);
            }

            sortNotes();
            closeEditor();
            render();
        } catch (failure) {
            error.textContent = failure.message;
        } finally {
            button.disabled = false;
        }
    });

    async function togglePin(note) {
        try {
            const body = await request(`${scope().url}/${note.id}`, { method: 'PUT', data: { pinned: !note.pinned } });
            state.notes = state.notes.map((item) => (item.id === body.note.id ? body.note : item));
            sortNotes();
            render();
        } catch (failure) {
            error.textContent = failure.message;
        }
    }

    async function remove(note) {
        try {
            await deleteJson(`${scope().url}/${note.id}`);
            state.notes = state.notes.filter((item) => item.id !== note.id);
            if (state.editing?.id === note.id) closeEditor();
            render();
        } catch (failure) {
            error.textContent = failure.message;
        }
    }

    // Apagar todas: pede confirmação com um segundo clique em até 3 segundos.
    const clearButton = $('[data-notes-clear]');
    let confirmTimer;

    clearButton.addEventListener('click', async () => {
        if (!clearButton.classList.contains('is-confirming')) {
            clearButton.classList.add('is-confirming');
            $('[data-notes-clear-label]').textContent = 'Confirmar?';
            confirmTimer = setTimeout(resetClear, 3000);
            return;
        }

        clearTimeout(confirmTimer);
        resetClear();

        try {
            await deleteJson(scope().url);
            state.notes = [];
            closeEditor();
            render();
        } catch (failure) {
            error.textContent = failure.message;
        }
    });

    function resetClear() {
        clearButton.classList.remove('is-confirming');
        $('[data-notes-clear-label]').textContent = 'Apagar todas';
    }

    // Busca e escopo

    $('[data-notes-search]').addEventListener('input', (event) => {
        state.search = event.target.value;
        render();
    });

    panel.querySelectorAll('[data-notes-scope]').forEach((button) => button.addEventListener('click', () => {
        if (state.scope === button.dataset.notesScope) return;
        state.scope = button.dataset.notesScope;
        state.tab = 'all';
        closeEditor();
        load();
    }));
}
