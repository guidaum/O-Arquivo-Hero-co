// Mapa do Mundo (WorldMap.tsx).
//
// O estado (marcadores, desenhos e sinais) chega por core/realtime.js: o
// servidor só reenvia marcadores e desenhos quando a versão muda. Modos:
// marcador (clique cria), desenho (camada SVG) e sinal (clique avisa a todos;
// Shift + clique também). Sem modo, arrastar move o mapa.

import { subscribe } from '../core/realtime.js';
import { deleteJson, postJson, request } from '../core/http.js';
import { el, icon, replace } from '../core/dom.js';
import { createViewport } from './viewport.js';
import { createDrawing } from './drawing.js';

const root = document.querySelector('[data-world-map]');

if (root) {
    const config = JSON.parse(root.dataset.config);
    const $ = (selector) => root.querySelector(selector);
    const viewportEl = $('[data-viewport]');
    const pinsLayer = $('[data-pins]');
    const pingsLayer = $('[data-pings]');
    const banner = $('[data-banner]');
    const detailDialog = document.getElementById('pin-detail');
    const formDialog = document.getElementById('pin-form');
    const form = formDialog.querySelector('[data-pin-form]');

    const state = {
        mode: null,
        version: null,
        pins: [],
        search: '',
        category: 'all',
        selected: null,
        editing: null,
        draftPoint: null,
        shownPings: new Set(),
    };

    const normalize = (text) => String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const category = (key) => config.categories[key] ?? config.categories.poi;
    const gridLabel = (point) => `${String.fromCharCode(65 + Math.min(9, Math.floor(point.x / 10)))}${Math.min(10, Math.floor(point.y / 10) + 1)}`;
    const coordText = (point) => `${gridLabel(point)} · X ${point.x.toFixed(1)}% · Y ${point.y.toFixed(1)}%`;

    // Avisos rápidos (faixa no topo do mapa)

    let bannerTimer;

    function notify(text, tone = 'info') {
        banner.textContent = text;
        banner.dataset.tone = tone;
        banner.hidden = false;
        clearTimeout(bannerTimer);
        bannerTimer = setTimeout(() => updateBanner(), 3500);
    }

    function updateBanner() {
        const hints = {
            pin: 'Clique no mapa para posicionar o novo marcador. Esc cancela.',
            ping: 'Clique no mapa para enviar um sinal a todos da campanha.',
            draw: null,
        };
        const hint = hints[state.mode] ?? null;
        banner.textContent = hint ?? '';
        banner.dataset.tone = 'info';
        banner.hidden = !hint;
    }

    // Navegação e desenho

    const viewport = createViewport({
        viewport: viewportEl,
        stage: $('[data-stage]'),
        image: $('[data-map-image]'),
        canPan: () => state.mode !== 'draw',
        onChange: (view) => { $('[data-zoom-label]').textContent = `${Math.round(view.scale * 100)}%`; },
        onClick: (event) => handleMapClick(event),
    });

    const drawing = createDrawing({
        layer: $('[data-drawings]'),
        toolbar: $('[data-draw-toolbar]'),
        url: config.drawingsUrl,
        toPercent: viewport.toPercent,
        notify,
    });

    function setMode(mode) {
        state.mode = state.mode === mode ? null : mode;
        root.dataset.mode = state.mode ?? '';
        root.querySelectorAll('[data-mode]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode)));
        drawing.setActive(state.mode === 'draw');
        updateBanner();
    }

    root.querySelectorAll('[data-mode]').forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode)));

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && state.mode && !document.querySelector('dialog[open]')) setMode(state.mode);
    });

    root.querySelectorAll('[data-zoom]').forEach((button) => button.addEventListener('click', () => {
        if (button.dataset.zoom === 'reset') viewport.reset();
        else viewport.zoomCenter(button.dataset.zoom === 'in' ? 1.3 : 1 / 1.3);
    }));

    const gridButton = $('[data-grid-toggle]');
    gridButton.addEventListener('click', () => {
        const visible = gridButton.getAttribute('aria-pressed') !== 'true';
        gridButton.setAttribute('aria-pressed', String(visible));
        $('[data-grid]').hidden = !visible;
    });

    const sidebarButton = $('[data-sidebar-toggle-map]');
    sidebarButton.addEventListener('click', () => {
        const open = sidebarButton.getAttribute('aria-pressed') !== 'true';
        sidebarButton.setAttribute('aria-pressed', String(open));
        root.classList.toggle('world-map--sidebar-closed', !open);
        setTimeout(() => viewport.reset(), 50);
    });

    viewportEl.addEventListener('pointermove', (event) => {
        const point = viewport.toPercent(event.clientX, event.clientY);
        $('[data-coords]').textContent = point ? coordText(point) : 'Fora do mapa';
    });

    function handleMapClick(event) {
        const point = viewport.toPercent(event.clientX, event.clientY);

        if (!point || event.target.closest('[data-pin]')) return;

        if (event.shiftKey || state.mode === 'ping') {
            sendPing(point);
        } else if (state.mode === 'pin') {
            openForm(null, point);
        }
    }

    // Estado do servidor

    const feed = subscribe(config.stateUrl, {
        interval: 3000,
        params: () => ({ versao: state.version ?? undefined }),
        onData(body) {
            state.version = body.version;

            if (body.changed) {
                state.pins = body.pins ?? [];
                drawing.setStrokes(body.drawings ?? []);
                renderPins();
                renderList();
                renderCategoryBar();

                if (state.selected) {
                    state.selected = state.pins.find((pin) => pin.id === state.selected.id) ?? null;
                    if (!state.selected && detailDialog.open) detailDialog.close();
                }
            }

            renderPings(body.pings ?? []);
        },
        onError(failure) {
            if (failure.status === 403) notify('Este mapa não está mais disponível para você.', 'error');
        },
    });

    // Marcadores no mapa

    function visiblePins() {
        const term = normalize(state.search);

        return state.pins.filter((pin) => (state.category === 'all' || pin.category === state.category)
            && (!term || normalize(`${pin.title} ${pin.description}`).includes(term)));
    }

    function pinElement(pin) {
        const settings = category(pin.category);

        return el('button', {
            type: 'button',
            class: `map-pin map-pin--${pin.danger_level}${state.selected?.id === pin.id ? ' is-selected' : ''}${pin.is_secret ? ' is-secret' : ''}`,
            style: `left: ${pin.x}%; top: ${pin.y}%; --pin-color: ${settings.color}`,
            title: `${pin.title} · ${settings.label}`,
            dataset: { pin: pin.id },
            onClick: (event) => {
                event.stopPropagation();
                openDetail(pin);
            },
        },
        el('span', { class: 'map-pin__marker' }, icon(pin.icon, 18)),
        el('span', { class: 'map-pin__label' }, pin.title));
    }

    function renderPins() {
        replace(pinsLayer, visiblePins().map(pinElement));
    }

    function renderCategoryBar() {
        const present = [...new Set(state.pins.map((pin) => pin.category))];

        replace($('[data-category-bar]'), present.length < 2 ? [] : [
            el('button', { type: 'button', class: `chip${state.category === 'all' ? ' is-active' : ''}`, onClick: () => setCategory('all') }, 'Todos'),
            ...present.map((key) => el('button', {
                type: 'button',
                class: `chip${state.category === key ? ' is-active' : ''}`,
                style: `--pin-color: ${category(key).color}`,
                onClick: () => setCategory(key),
            }, icon(category(key).icon, 12), ' ', category(key).short)),
        ]);
    }

    function setCategory(key) {
        state.category = key;
        $('[data-pin-category]').value = key;
        renderPins();
        renderList();
        renderCategoryBar();
    }

    // Lista lateral

    function renderList() {
        const list = visiblePins();
        $('[data-pin-count]').textContent = String(list.length);

        replace($('[data-pin-list]'), list.length === 0
            ? el('li', { class: 'pin-list__empty' }, state.pins.length ? 'Nenhum marcador encontrado.' : 'Nenhum marcador neste mapa ainda.')
            : list.map((pin) => {
                const settings = category(pin.category);

                return el('li', {},
                    el('button', {
                        type: 'button',
                        class: `pin-list__item${state.selected?.id === pin.id ? ' is-selected' : ''}`,
                        style: `--pin-color: ${settings.color}`,
                        onClick: () => {
                            viewport.focus(pin);
                            openDetail(pin);
                        },
                    },
                    el('span', { class: 'pin-list__icon' }, icon(pin.icon, 16)),
                    el('span', { class: 'pin-list__text' },
                        el('strong', {}, pin.title, pin.is_secret ? el('small', { class: 'pin-list__secret' }, ' · secreto') : null),
                        el('small', {}, `${settings.short} · ${config.dangerLevels[pin.danger_level]} · ${gridLabel(pin)}`))));
            }));
    }

    $('[data-pin-search]').addEventListener('input', (event) => {
        state.search = event.target.value;
        renderPins();
        renderList();
    });
    $('[data-pin-category]').addEventListener('change', (event) => setCategory(event.target.value));

    // Detalhe

    function openDetail(pin) {
        state.selected = pin;
        const settings = category(pin.category);

        detailDialog.querySelector('.modal__title').textContent = pin.title;
        replace(detailDialog.querySelector('[data-pin-detail]'),
            el('div', { class: 'pin-detail__badges' },
                el('span', { class: 'badge badge--pill', style: `--badge-color: ${settings.color}` }, icon(pin.icon, 12), ' ', settings.label),
                el('span', { class: `badge badge--pill pin-danger pin-danger--${pin.danger_level}` }, config.dangerLevels[pin.danger_level]),
                el('span', { class: 'badge badge--pill' }, config.statuses[pin.status]),
                pin.is_secret ? el('span', { class: 'badge badge--pill badge--gm' }, icon('lock', 12), ' Secreto') : null),
            el('p', { class: 'pin-detail__coords' },
                icon('crosshair', 14), ` ${coordText(pin)} `,
                el('button', { type: 'button', class: 'button button--link', 'data-copy': `${pin.title} — ${coordText(pin)}` }, icon('copy', 14), ' Copiar')),
            pin.description ? el('p', { class: 'pin-detail__description' }, pin.description) : el('p', { class: 'muted' }, 'Sem descrição.'),
            pin.secrets ? el('div', { class: 'pin-detail__secrets' }, el('strong', {}, icon('lock', 14), ' Segredos do Mestre / Lore Oculta'), el('p', {}, pin.secrets)) : null,
            el('p', { class: 'pin-detail__meta' },
                `Descoberto por: ${pin.discovered_by || 'Aventureiro'}`,
                pin.discovered_on ? ` · Data: ${pin.discovered_on}` : ''));

        detailDialog.querySelector('[data-pin-edit]').hidden = !pin.can_edit;
        detailDialog.querySelector('[data-pin-delete]').hidden = !pin.can_edit;

        const dungeonLink = detailDialog.querySelector('[data-pin-dungeon]');
        const showDungeon = config.dungeonUrl && ['dungeon', 'ruins', 'danger'].includes(pin.category);
        dungeonLink.hidden = !showDungeon;
        if (showDungeon) dungeonLink.href = config.dungeonUrl;

        renderPins();
        renderList();
        if (!detailDialog.open) detailDialog.showModal();
    }

    detailDialog.addEventListener('close', () => {
        state.selected = null;
        renderPins();
        renderList();
    });

    detailDialog.querySelector('[data-pin-edit]').addEventListener('click', () => {
        const pin = state.selected;
        detailDialog.close();
        openForm(pin, pin);
    });

    detailDialog.querySelector('[data-pin-delete]').addEventListener('click', async () => {
        const pin = state.selected;

        if (!pin || !window.confirm(`Excluir o marcador "${pin.title}"?`)) return;

        try {
            const body = await deleteJson(`${config.pinsUrl}/${pin.id}`);
            detailDialog.close();
            state.pins = state.pins.filter((item) => item.id !== pin.id);
            renderPins();
            renderList();
            notify(body.message, 'success');
            feed.refresh();
        } catch (failure) {
            notify(failure.message, 'error');
        }
    });

    // Formulário

    function openForm(pin, point) {
        state.editing = pin;
        state.draftPoint = { x: point.x, y: point.y };
        form.reset();
        form.querySelector('[data-pin-error]').textContent = '';
        formDialog.querySelector('.modal__title').textContent = pin ? 'Editar Marcador' : 'Novo Marcador';
        form.querySelector('[data-pin-coords]').replaceChildren(icon('crosshair', 14), ` ${coordText(point)}`);

        const values = pin ?? {
            category: state.category !== 'all' ? state.category : 'dungeon',
            custom_icon: '',
            danger_level: 'moderate',
            status: 'explored',
            discovered_on_value: new Date().toISOString().slice(0, 10),
        };

        form.elements.title.value = pin?.title ?? '';
        form.querySelectorAll('input[name="category"]').forEach((input) => { input.checked = input.value === values.category; });
        form.querySelectorAll('input[name="custom_icon"]').forEach((input) => { input.checked = input.value === (values.custom_icon ?? ''); });
        form.elements.danger_level.value = values.danger_level;
        form.elements.status.value = values.status;
        form.elements.discovered_on.value = values.discovered_on_value ?? '';
        form.elements.description.value = pin?.description ?? '';
        if (form.elements.secrets) form.elements.secrets.value = pin?.secrets ?? '';
        if (form.elements.is_secret) form.elements.is_secret.checked = Boolean(pin?.is_secret);

        if (state.mode === 'pin') setMode('pin');
        formDialog.showModal();
        form.elements.title.focus();
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const data = {
            title: form.elements.title.value.trim(),
            category: form.querySelector('input[name="category"]:checked')?.value ?? 'poi',
            custom_icon: form.querySelector('input[name="custom_icon"]:checked')?.value || null,
            danger_level: form.elements.danger_level.value,
            status: form.elements.status.value,
            discovered_on: form.elements.discovered_on.value || null,
            description: form.elements.description.value,
            x: state.draftPoint.x,
            y: state.draftPoint.y,
        };

        if (form.elements.secrets) {
            data.secrets = form.elements.secrets.value;
            data.is_secret = form.elements.is_secret.checked;
        }

        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;

        try {
            const body = state.editing
                ? await request(`${config.pinsUrl}/${state.editing.id}`, { method: 'PUT', data })
                : await postJson(config.pinsUrl, data);

            state.pins = [...state.pins.filter((pin) => pin.id !== body.pin.id), body.pin];
            formDialog.close();
            renderPins();
            renderList();
            renderCategoryBar();
            notify(body.message, 'success');
            feed.refresh();
        } catch (failure) {
            form.querySelector('[data-pin-error]').textContent = failure.message;
        } finally {
            button.disabled = false;
        }
    });

    // Sinais

    async function sendPing(point) {
        try {
            const body = await postJson(config.pingsUrl, point);
            renderPings([body.ping], true);
        } catch (failure) {
            notify(failure.message, 'error');
        }
    }

    function renderPings(pings, append = false) {
        const fresh = pings.filter((ping) => !state.shownPings.has(ping.id));

        fresh.forEach((ping) => {
            state.shownPings.add(ping.id);
            const node = el('div', { class: 'map-ping', style: `left: ${ping.x}%; top: ${ping.y}%; --ping-color: ${ping.color}` },
                el('span', { class: 'map-ping__pulse' }),
                el('span', { class: 'map-ping__core' }),
                el('span', { class: 'map-ping__label' }, ping.mine ? 'Você' : ping.user_name));
            pingsLayer.append(node);
            setTimeout(() => node.remove(), 6000);
        });

        if (!append && state.shownPings.size > 200) state.shownPings = new Set([...state.shownPings].slice(-100));
    }

    // Mestre: ativar ou ocultar mapas na campanha

    root.querySelectorAll('[data-map-active]').forEach((input) => input.addEventListener('change', async () => {
        try {
            const body = await request(input.dataset.mapActive, { method: 'PUT', data: { active: input.checked } });
            notify(body.message, 'success');
        } catch (failure) {
            input.checked = !input.checked;
            notify(failure.message, 'error');
        }
    }));

    updateBanner();
}
