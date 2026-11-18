// Painel lateral da masmorra (estilo Roll20), recolhível, dentro e fora do
// Modo TV (o nome do arquivo vem de quando ele só existia no Modo TV).
// - Tokens e Combate: desenhados por panel.js; o token/área selecionado fica
//   acima das abas e, com o painel recolhido, abre o painel enquanto durar a
//   seleção (evento dungeon:selection);
// - Campanha (mestre): jogadores, NPCs e monstros com a vida (gm/health.js,
//   mesma rota do Painel do Mestre) e "Ver ficha";
// - Ficha: a página da ficha embutida (carrega só quando a aba abre);
// - Chat: o chat do menu de ações fica acoplado aqui (evento chat:dock), então
//   a página continua com um chat só; o botão de chat do menu abre esta aba;
// - Notas: anotações rápidas (campanha para o mestre, personagem para o
//   jogador), com o quadro do Escudo (gm-screen/notes.js), carregadas na
//   primeira abertura para não consultar o servidor à toa.
// Aberto/recolhido (um estado para o mapa normal, outro para o Modo TV) e a
// última aba ficam no navegador.

import { setupHealth } from '../gm/health.js';
import { setupNotes } from '../gm-screen/notes.js';

const STORAGE_KEY = 'dungeon:tv-drawer';

function load() {
    try {
        return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') ?? {};
    } catch (error) {
        return {};
    }
}

function save(value) {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch (error) {
        // Armazenamento indisponível: o painel só não lembra o estado.
    }
}

export function createTvDrawer(ctx) {
    const drawer = ctx.root.querySelector('[data-tv-drawer]');
    if (!drawer) return { setTv() {} };

    const sessionId = Number(drawer.dataset.session);
    const toggle = drawer.querySelector('[data-tv-drawer-toggle]');
    const badge = drawer.querySelector('[data-tv-chat-badge]');
    const tabs = [...drawer.querySelectorAll('[data-tv-tab]')];
    const chatSlot = drawer.querySelector('[data-tv-chat-slot]');
    const sheetSelect = drawer.querySelector('[data-tv-sheet-select]');
    const sheetFrame = drawer.querySelector('[data-tv-sheet-frame]');
    const sheetLink = drawer.querySelector('[data-tv-sheet-link]');
    const notesConfig = JSON.parse(drawer.dataset.notes || '{}');
    const saved = load();
    const hasTab = (key) => tabs.some((tab) => tab.dataset.tvTab === key);
    const notify = (text, tone = 'info') => ctx.notify(text, tone === 'danger' ? 'error' : tone);

    const state = {
        tv: false,
        // Começa aberto (a lista de tokens mora aqui); cada modo lembra o seu.
        openMap: saved.openMap ?? true,
        openTv: saved.openTv ?? true,
        tab: hasTab(saved.tab) ? saved.tab : tabs[0]?.dataset.tvTab,
        unread: 0,
        notesReady: false,
        // Aberto só enquanto há um token/área selecionado (o painel estava recolhido).
        peeking: false,
    };

    const isOpen = () => state.peeking || (state.tv ? state.openTv : state.openMap);

    function setOpen(open) {
        state.peeking = false;
        if (state.tv) state.openTv = open;
        else state.openMap = open;
    }

    // Selecionar um token com o painel recolhido abre o painel para mostrar o
    // token; desmarcar recolhe de novo (sem mudar a preferência guardada).
    document.addEventListener('dungeon:selection', (event) => {
        if (event.detail?.selected) {
            if (isOpen()) return;
            state.peeking = true;
        } else if (state.peeking) {
            state.peeking = false;
        } else {
            return;
        }
        apply();
    });

    if (ctx.config.isGm) setupHealth(drawer, { notify });

    // Ficha

    function loadSheet() {
        const option = sheetSelect?.selectedOptions[0];
        if (!option || !sheetFrame) return;

        const url = option.dataset.url;
        sheetLink.href = url;
        if (sheetFrame.getAttribute('src') !== url) sheetFrame.setAttribute('src', url);
    }

    sheetSelect?.addEventListener('change', loadSheet);

    drawer.addEventListener('click', (event) => {
        const trigger = event.target.closest('[data-tv-sheet-open]');
        if (!trigger || !sheetSelect) return;

        sheetSelect.value = trigger.dataset.tvSheetOpen;
        show('ficha');
    });

    // Busca de personagens (mestre)

    const search = drawer.querySelector('[data-tv-search]');
    search?.addEventListener('input', () => {
        const term = search.value.trim().toLocaleLowerCase('pt-BR');
        let visible = 0;

        drawer.querySelectorAll('[data-tv-character]').forEach((row) => {
            row.hidden = term !== '' && !row.dataset.search.includes(term);
            if (!row.hidden) visible++;
        });
        drawer.querySelector('[data-tv-search-empty]').hidden = visible > 0;
    });

    // Mensagens novas com o chat fora de vista

    const chatVisible = () => isOpen() && state.tab === 'chat';

    function renderBadge() {
        badge.hidden = state.unread === 0;
        badge.textContent = state.unread > 99 ? '99+' : String(state.unread);
        tabs.find((tab) => tab.dataset.tvTab === 'chat')?.classList.toggle('has-unread', state.unread > 0);
    }

    document.addEventListener('chat:incoming', (event) => {
        if (event.detail?.sessionId !== sessionId || chatVisible()) return;

        state.unread += event.detail.count;
        renderBadge();
    });

    // Abrir, recolher e trocar de aba

    function apply() {
        const open = isOpen();
        drawer.classList.toggle('is-collapsed', !open);
        toggle.setAttribute('aria-expanded', String(open));
        toggle.title = open ? 'Recolher o painel' : 'Abrir o painel (ficha, chat e anotações)';
        document.documentElement.classList.toggle('is-tv-drawer-open', open);

        tabs.forEach((tab) => {
            const current = tab.dataset.tvTab === state.tab;
            tab.setAttribute('aria-selected', String(current));
            if (current) tab.setAttribute('aria-current', 'page');
            else tab.removeAttribute('aria-current');
        });
        drawer.querySelectorAll('[data-tv-pane]').forEach((pane) => { pane.hidden = pane.dataset.tvPane !== state.tab; });

        if (open) {
            if (state.tab === 'ficha') loadSheet();
            if (state.tab === 'notas' && !state.notesReady && notesConfig.url) {
                state.notesReady = true;
                setupNotes(drawer, notesConfig, notify);
            }
        }
        if (chatVisible()) state.unread = 0;

        renderBadge();
        save({ openMap: state.openMap, openTv: state.openTv, tab: state.tab });
    }

    function show(tab) {
        if (hasTab(tab)) state.tab = tab;
        setOpen(true);
        apply();
    }

    toggle.addEventListener('click', () => {
        setOpen(!isOpen());
        apply();
    });

    tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => show(tab.dataset.tvTab));
        tab.addEventListener('keydown', (event) => {
            const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
            if (!step) return;

            event.preventDefault();
            const next = tabs[(index + step + tabs.length) % tabs.length];
            next.focus();
            show(next.dataset.tvTab);
        });
    });

    // O botão de chat do menu de ações abre esta aba (o chat mora aqui).
    document.addEventListener('tool:toggle', (event) => {
        if (event.detail?.tool === 'chat' && event.detail.open !== false) show('chat');
    });

    // Acopla o chat; se o script do chat ainda não rodou, tenta de novo quando
    // a página termina de carregar (todos os módulos rodam antes disso).
    const dock = () => document.dispatchEvent(new CustomEvent('chat:dock', { detail: { sessionId, slot: chatSlot } }));
    dock();
    if (!chatSlot.querySelector('[data-chat]')) document.addEventListener('DOMContentLoaded', dock, { once: true });

    // Link de notificação (?chat=1): abre direto no chat.
    if (new URLSearchParams(window.location.search).get('chat') === '1') show('chat');
    else apply();

    return {
        setTv(on) {
            if (state.tv === on) return;
            state.tv = on;
            state.peeking = false;
            document.documentElement.classList.toggle('is-tv-mode', on);
            apply();
        },
    };
}
