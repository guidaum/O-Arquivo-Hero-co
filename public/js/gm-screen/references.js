// Referências visuais do Escudo do Mestre: imagens (arquivo ou link) com
// categoria e anotações privadas. Clicar na imagem abre o visualizador
// (core/lightbox.js); "Mostrar" envia a imagem ao chat da campanha.

import { request, postJson, deleteJson } from '../core/http.js';
import { el, icon, replace, busy } from '../core/dom.js';

export function setupReferences(root, config, notify) {
    const pane = root.querySelector('[data-screen-pane="referencias"]');
    const dialog = document.getElementById('gm-screen-reference');
    if (!pane || !dialog || !config) return;

    const list = pane.querySelector('[data-reference-list]');
    const empty = pane.querySelector('[data-reference-empty]');
    const search = pane.querySelector('[data-reference-search]');
    const filterBar = pane.querySelector('[data-reference-filter]');
    const counter = root.querySelector('[data-reference-count]');
    const form = dialog.querySelector('[data-reference-form]');
    const imageFields = form.querySelector('[data-reference-image]');
    const error = form.querySelector('[data-reference-error]');
    const categories = config.categories;
    const urlFor = (reference, suffix = '') => `${config.baseUrl}/${reference.id}${suffix}`;

    const state = { items: config.items ?? [], filter: 'all', editing: null };

    replace(form.querySelector('[data-reference-category]'),
        ...Object.entries(categories).map(([key, label]) => el('option', { value: key }, label)));

    const sortItems = () => state.items.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.id - a.id);

    function renderFilters() {
        const counts = state.items.reduce((all, item) => ({ ...all, [item.category]: (all[item.category] ?? 0) + 1 }), {});
        const options = [['all', 'Todas', state.items.length], ...Object.entries(categories)
            .filter(([key]) => counts[key])
            .map(([key, label]) => [key, label, counts[key]])];

        if (state.filter !== 'all' && !counts[state.filter]) state.filter = 'all';

        replace(filterBar, ...options.map(([key, label, count]) => el('button', {
            type: 'button',
            class: 'chip',
            'aria-pressed': String(state.filter === key),
            onClick: () => { state.filter = key; render(); },
        }, label, ' ', el('small', {}, String(count)))));
    }

    function share(button, item) {
        busy(button, async () => {
            try {
                const body = await postJson(urlFor(item, '/mostrar'));
                notify(body.message, 'success');
            } catch (failure) {
                notify(failure.message, 'error');
            }
        });
    }

    function togglePin(button, item) {
        busy(button, async () => {
            try {
                const body = await request(urlFor(item), { method: 'PUT', data: { pinned: !item.pinned } });
                Object.assign(item, body.reference);
                sortItems();
                render();
            } catch (failure) {
                notify(failure.message, 'error');
            }
        });
    }

    function remove(button, item) {
        if (button.dataset.confirm !== 'true') {
            button.dataset.confirm = 'true';
            button.classList.add('is-confirming');
            button.title = 'Clique de novo para excluir';
            setTimeout(() => { button.dataset.confirm = 'false'; button.classList.remove('is-confirming'); button.title = 'Excluir'; }, 3000);
            return;
        }

        busy(button, async () => {
            try {
                const body = await deleteJson(urlFor(item));
                state.items = state.items.filter((other) => other.id !== item.id);
                render();
                notify(body.message, 'success');
            } catch (failure) {
                notify(failure.message, 'error');
            }
        });
    }

    function card(item) {
        return el('li', { class: `screen-reference${item.pinned ? ' is-pinned' : ''}` },
            el('figure', { class: 'screen-reference__figure' },
                el('img', { src: item.image_url, alt: item.title, loading: 'lazy' }),
                item.pinned ? el('span', { class: 'screen-reference__pin', title: 'Fixada' }, icon('pin', 12)) : null,
            ),
            el('div', { class: 'screen-reference__body' },
                el('span', { class: 'screen-note__category' }, categories[item.category] ?? 'Outro'),
                el('h3', {}, item.title),
                item.notes ? el('p', { class: 'screen-reference__notes' }, item.notes) : null,
            ),
            el('div', { class: 'screen-reference__actions' },
                el('button', { type: 'button', class: 'button button--secondary', title: 'Enviar a imagem ao chat da campanha', onClick: (event) => share(event.currentTarget, item) }, icon('send', 14), ' Mostrar'),
                el('button', { type: 'button', class: 'icon-button', title: item.pinned ? 'Desafixar' : 'Fixar no topo', 'aria-pressed': String(item.pinned), onClick: (event) => togglePin(event.currentTarget, item) }, icon('pin', 15)),
                el('button', { type: 'button', class: 'icon-button', title: 'Editar', onClick: () => openForm(item) }, icon('pencil', 15)),
                el('button', { type: 'button', class: 'icon-button icon-button--danger', title: 'Excluir', onClick: (event) => remove(event.currentTarget, item) }, icon('trash', 15)),
            ),
        );
    }

    function render() {
        renderFilters();
        const term = search.value.trim().toLocaleLowerCase('pt-BR');
        const visible = state.items.filter((item) => (state.filter === 'all' || item.category === state.filter)
            && (term === '' || `${item.title} ${item.notes}`.toLocaleLowerCase('pt-BR').includes(term)));

        replace(list, ...visible.map(card));
        if (counter) counter.textContent = String(state.items.length);
        empty.hidden = visible.length > 0;
        empty.textContent = state.items.length === 0
            ? 'Nenhuma referência ainda. Guarde retratos de NPCs, cenários e itens para mostrar aos jogadores na hora certa.'
            : 'Nenhuma referência com este filtro.';
    }

    function openForm(item = null) {
        state.editing = item;
        form.reset();
        error.textContent = '';
        imageFields.hidden = item !== null;
        imageFields.disabled = item !== null;
        form.elements.title.value = item?.title ?? '';
        form.elements.category.value = item?.category ?? (state.filter !== 'all' ? state.filter : 'scene');
        form.elements.notes.value = item?.notes ?? '';
        dialog.querySelector('.modal__title').textContent = item ? 'Editar referência' : 'Nova referência';
        dialog.showModal();
        form.elements.title.focus();
    }

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        error.textContent = '';

        busy(form, async () => {
            try {
                let body;

                if (state.editing) {
                    body = await request(urlFor(state.editing), {
                        method: 'PUT',
                        data: { title: form.elements.title.value, category: form.elements.category.value, notes: form.elements.notes.value },
                    });
                    Object.assign(state.editing, body.reference);
                } else {
                    const data = new FormData(form);
                    if (!form.elements.image.files.length) data.delete('image');
                    if (!form.elements.image_url.value.trim()) data.delete('image_url');
                    body = await postJson(config.storeUrl, data);
                    state.items.push(body.reference);
                }

                sortItems();
                render();
                dialog.close();
                notify(body.message, 'success');
            } catch (failure) {
                error.textContent = failure.message;
            }
        });
    });

    pane.querySelector('[data-reference-new]').addEventListener('click', () => openForm());
    search.addEventListener('input', render);

    sortItems();
    render();
}
