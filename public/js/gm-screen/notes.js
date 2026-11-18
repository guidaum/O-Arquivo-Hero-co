// Anotações da campanha no Escudo do Mestre: as mesmas anotações rápidas do
// menu de ações (rotas sessions.notes.*), em quadro, com busca, categorias,
// fixar no topo, edição e exclusão (segundo clique confirma).

import { request, postJson, deleteJson } from '../core/http.js';
import { el, icon, replace, busy } from '../core/dom.js';

export function setupNotes(root, config, notify) {
    const pane = root.querySelector('[data-screen-pane="anotacoes"]');
    if (!pane || !config) return;

    const list = pane.querySelector('[data-notes-list]');
    const empty = pane.querySelector('[data-notes-empty]');
    const search = pane.querySelector('[data-notes-search]');
    const filterBar = pane.querySelector('[data-notes-filter]');
    const form = pane.querySelector('[data-notes-form]');
    const categoryBar = form.querySelector('[data-notes-category]');
    const categories = config.categories;

    const state = { notes: [], filter: 'all', editing: null, category: 'general', loaded: false };

    const sortNotes = () => state.notes.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.id - a.id);

    function renderFilters() {
        const counts = state.notes.reduce((all, note) => ({ ...all, [note.category]: (all[note.category] ?? 0) + 1 }), {});
        const options = [['all', 'Todas', state.notes.length], ...Object.entries(categories).map(([key, label]) => [key, label, counts[key] ?? 0])];

        replace(filterBar, ...options.map(([key, label, count]) => el('button', {
            type: 'button',
            class: 'chip',
            'aria-pressed': String(state.filter === key),
            onClick: () => { state.filter = key; render(); },
        }, label, ' ', el('small', {}, String(count)))));
    }

    function renderCategoryPicker() {
        replace(categoryBar, ...Object.entries(categories).map(([key, label]) => el('button', {
            type: 'button',
            class: 'chip',
            role: 'radio',
            'aria-checked': String(state.category === key),
            onClick: () => { state.category = key; renderCategoryPicker(); },
        }, label)));
    }

    function confirmDelete(button, note) {
        if (button.dataset.confirm !== 'true') {
            button.dataset.confirm = 'true';
            button.classList.add('is-confirming');
            button.title = 'Clique de novo para excluir';
            setTimeout(() => { button.dataset.confirm = 'false'; button.classList.remove('is-confirming'); button.title = 'Excluir'; }, 3000);
            return;
        }

        busy(button, async () => {
            try {
                const body = await deleteJson(`${config.url}/${note.id}`);
                state.notes = state.notes.filter((other) => other.id !== note.id);
                render();
                notify(body.message, 'success');
            } catch (failure) {
                notify(failure.message, 'error');
            }
        });
    }

    function togglePin(button, note) {
        busy(button, async () => {
            try {
                const body = await request(`${config.url}/${note.id}`, { method: 'PUT', data: { pinned: !note.pinned } });
                Object.assign(note, body.note);
                sortNotes();
                render();
            } catch (failure) {
                notify(failure.message, 'error');
            }
        });
    }

    function noteCard(note) {
        return el('li', { class: `screen-note screen-note--${note.category}${note.pinned ? ' is-pinned' : ''}` },
            el('header', { class: 'screen-note__header' },
                el('span', { class: 'screen-note__category' }, categories[note.category] ?? 'Geral'),
                el('div', { class: 'screen-note__actions' },
                    el('button', { type: 'button', class: 'icon-button', title: note.pinned ? 'Desafixar' : 'Fixar no topo', 'aria-pressed': String(note.pinned), onClick: (event) => togglePin(event.currentTarget, note) }, icon('pin', 15)),
                    el('button', { type: 'button', class: 'icon-button', title: 'Editar', onClick: () => openEditor(note) }, icon('pencil', 15)),
                    el('button', { type: 'button', class: 'icon-button icon-button--danger', title: 'Excluir', onClick: (event) => confirmDelete(event.currentTarget, note) }, icon('trash', 15)),
                ),
            ),
            el('h3', {}, note.title),
            note.content ? el('p', { class: 'screen-note__content' }, note.content) : null,
        );
    }

    function render() {
        renderFilters();
        const term = search.value.trim().toLocaleLowerCase('pt-BR');
        const visible = state.notes.filter((note) => (state.filter === 'all' || note.category === state.filter)
            && (term === '' || `${note.title} ${note.content}`.toLocaleLowerCase('pt-BR').includes(term)));

        replace(list, ...visible.map(noteCard));
        empty.hidden = !state.loaded || visible.length > 0;
        empty.textContent = state.notes.length === 0
            ? 'Nenhuma anotação ainda. Guarde ganchos, nomes de NPCs, locais e tesouros para consultar durante a sessão.'
            : 'Nenhuma anotação com este filtro.';
    }

    function openEditor(note = null) {
        state.editing = note;
        state.category = note?.category ?? (state.filter !== 'all' ? state.filter : 'general');
        form.elements.title.value = note?.title ?? '';
        form.elements.content.value = note?.content ?? '';
        renderCategoryPicker();
        form.hidden = false;
        form.elements.title.focus();
    }

    function closeEditor() {
        state.editing = null;
        form.hidden = true;
        form.reset();
    }

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        const data = { title: form.elements.title.value, content: form.elements.content.value, category: state.category };

        busy(form, async () => {
            try {
                const body = state.editing
                    ? await request(`${config.url}/${state.editing.id}`, { method: 'PUT', data })
                    : await postJson(config.url, data);

                if (state.editing) Object.assign(state.editing, body.note); else state.notes.push(body.note);
                sortNotes();
                closeEditor();
                render();
                notify('Anotação salva.', 'success');
            } catch (failure) {
                notify(failure.message, 'error');
            }
        });
    });

    form.querySelector('[data-notes-cancel]').addEventListener('click', closeEditor);
    pane.querySelector('[data-notes-new]').addEventListener('click', () => openEditor());
    search.addEventListener('input', render);

    render();
    request(config.url)
        .then((body) => {
            state.notes = body.notes ?? [];
            state.loaded = true;
            sortNotes();
            render();
        })
        .catch((failure) => notify(failure.message, 'error'));
}
