// Escudo do Mestre: abas da mesa de trabalho (a última fica guardada), ficha
// em popup, busca de NPCs, descanso do grupo e os módulos de anotações,
// referências e notas do mestre. A vida reaproveita o módulo do Painel.

import { setupHealth } from '../gm/health.js';
import { toast } from '../core/toast.js';
import { setupNotes } from './notes.js';
import { setupReferences } from './references.js';
import { setupGmNotes } from './gm-notes.js';

const root = document.querySelector('[data-gm-screen]');

function storage(key, value) {
    try {
        if (value === undefined) return window.localStorage.getItem(key);
        window.localStorage.setItem(key, value);
    } catch (error) {
        // Sem armazenamento: a aba volta para a primeira ao recarregar.
    }

    return null;
}

function setupTabs(config) {
    const tabs = [...root.querySelectorAll('[data-screen-tab]')];
    const panes = [...root.querySelectorAll('[data-screen-pane]')];
    const key = `${config.storageKey}:aba`;

    const select = (name, remember = true) => {
        if (!tabs.some((tab) => tab.dataset.screenTab === name)) return;

        tabs.forEach((tab) => {
            const active = tab.dataset.screenTab === name;
            tab.setAttribute('aria-selected', String(active));
            if (active) tab.setAttribute('aria-current', 'page'); else tab.removeAttribute('aria-current');
            tab.tabIndex = active ? 0 : -1;
        });
        panes.forEach((pane) => { pane.hidden = pane.dataset.screenPane !== name; });
        if (remember) storage(key, name);
    };

    tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => select(tab.dataset.screenTab));
        tab.addEventListener('keydown', (event) => {
            if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
            const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
            select(next.dataset.screenTab);
            next.focus();
        });
    });

    select(storage(key) ?? tabs[0]?.dataset.screenTab, false);
}

// Ficha em popup: a página da ficha num iframe (html.is-embedded esconde o menu).
function setupSheetPopup() {
    const dialog = document.getElementById('gm-screen-sheet');
    const frame = dialog?.querySelector('[data-sheet-frame]');
    if (!dialog || !frame) return;

    document.addEventListener('click', (event) => {
        const trigger = event.target.closest('[data-sheet-open]');
        if (!trigger) return;

        const url = trigger.dataset.sheetOpen;
        dialog.querySelector('.modal__title').textContent = `Ficha · ${trigger.dataset.sheetName ?? ''}`;
        dialog.querySelector('[data-sheet-link]').href = url;
        if (frame.getAttribute('src') !== url) frame.setAttribute('src', url);
        dialog.showModal();
    });

    // Ao fechar, recarrega a próxima abertura (a ficha pode ter mudado).
    dialog.addEventListener('close', () => frame.setAttribute('src', 'about:blank'));
}

function setupNpcFilter() {
    const panel = root.querySelector('[data-npc-panel]');
    const search = panel?.querySelector('[data-npc-search]');
    if (!search) return;

    const rows = [...panel.querySelectorAll('[data-npc]')];
    const kinds = [...panel.querySelectorAll('[data-npc-kind]')];
    const empty = panel.querySelector('[data-npc-empty]');
    let kind = 'all';

    const apply = () => {
        const term = search.value.trim().toLocaleLowerCase('pt-BR');
        let visible = 0;

        rows.forEach((row) => {
            const show = (kind === 'all' || row.dataset.kind === kind) && (term === '' || row.dataset.search.includes(term));
            row.hidden = !show;
            if (show) visible += 1;
        });
        empty.hidden = visible > 0;
    };

    search.addEventListener('input', apply);
    kinds.forEach((button) => button.addEventListener('click', () => {
        kind = button.dataset.npcKind;
        kinds.forEach((other) => other.setAttribute('aria-pressed', String(other === button)));
        apply();
    }));
}

// Descanso longo para todo o grupo: aciona o botão de cada cartão, um por vez.
function setupPartyRest() {
    const button = root.querySelector('[data-party-long-rest]');
    if (!button) return;

    button.addEventListener('click', async () => {
        if (button.dataset.confirm !== 'true') {
            button.dataset.confirm = 'true';
            button.lastChild.textContent = ' Confirmar descanso?';
            setTimeout(() => {
                button.dataset.confirm = 'false';
                button.lastChild.textContent = ' Descanso do grupo';
            }, 3000);
            return;
        }

        button.dataset.confirm = 'false';
        button.disabled = true;
        const rests = [...root.querySelectorAll('[data-party-card] [data-party-rest]')];

        for (const rest of rests) {
            rest.click();
            // health.js ignora cliques enquanto a requisição anterior do mesmo cartão roda.
            // eslint-disable-next-line no-await-in-loop
            await new Promise((resolve) => { setTimeout(resolve, 250); });
        }

        button.lastChild.textContent = ' Descanso do grupo';
        button.disabled = false;
    });
}

if (root) {
    const config = JSON.parse(root.dataset.config);
    const notify = (text, tone = 'info') => toast(text, tone);

    setupTabs(config);
    setupSheetPopup();
    setupNpcFilter();
    setupPartyRest();
    setupHealth(root, { notify });
    setupNotes(root, config.notes, notify);
    setupReferences(root, config.references, notify);
    setupGmNotes(root, notify);
}
