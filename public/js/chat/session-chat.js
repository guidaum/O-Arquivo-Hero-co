// Chat da Sessão (SessionChat.tsx do sistema antigo).
//
// As mensagens chegam por core/realtime.js: rápido com o painel aberto,
// devagar com ele fechado (só para contar as não lidas). Textos entram
// sempre como texto (core/dom.js); links e @menções viram elementos à parte.
// A última mensagem lida fica no navegador, por campanha.

import { subscribe } from '../core/realtime.js';
import { deleteJson, postJson } from '../core/http.js';
import { el, icon, replace } from '../core/dom.js';

const OPEN_INTERVAL = 3000;
const CLOSED_INTERVAL = 15000;
const TOKEN = /(https?:\/\/[^\s]+|@[\p{L}\p{N}_]+)/u;

const normalize = (text) => String(text ?? '').toLocaleLowerCase('pt-BR').replace(/\s+/g, '');

function storage(key, value) {
    try {
        if (value === undefined) return window.localStorage.getItem(key);
        window.localStorage.setItem(key, String(value));
    } catch (error) {
        // Armazenamento indisponível: as não lidas valem só para esta página.
    }

    return null;
}

function setupChat(root) {
    const config = JSON.parse(root.dataset.config);
    const panel = root.querySelector('[data-chat-panel]');
    const list = root.querySelector('[data-chat-messages]');
    const empty = root.querySelector('[data-chat-empty]');
    const form = root.querySelector('[data-chat-form]');
    const input = root.querySelector('[data-chat-input]');
    const send = root.querySelector('[data-chat-send]');
    const error = root.querySelector('[data-chat-error]');
    const badge = root.querySelector('[data-chat-badge]');
    const mentionBox = root.querySelector('[data-chat-mentions]');
    const imageRow = root.querySelector('[data-chat-image-row]');
    const imageUrl = root.querySelector('[data-chat-image-url]');
    const imageFile = root.querySelector('[data-chat-image-file]');
    const attachment = root.querySelector('[data-chat-attachment]');
    const readKey = `chat-read:${config.sessionId}`;
    const participants = config.participants ?? [];
    const myHandles = new Set(participants.filter((person) => person.user_id === config.userId).map((person) => person.handle));

    const state = {
        open: false,
        cursor: 0,
        clearedAt: undefined,
        lastRead: Number(storage(readKey)) || 0,
        messages: [],
        mentions: { items: [], index: 0, start: -1 },
    };

    // Mensagens

    function participantFor(mention) {
        const handle = normalize(mention);

        return participants.find((person) => person.handle === handle)
            ?? participants.find((person) => person.handle.startsWith(handle));
    }

    function formatText(text, mine) {
        return text.split(TOKEN).filter(Boolean).map((part) => {
            if (/^https?:\/\//.test(part)) {
                return el('a', { href: part, target: '_blank', rel: 'noopener noreferrer nofollow', class: 'chat-link' }, part);
            }

            if (part.startsWith('@')) {
                const person = participantFor(part.slice(1));

                if (person) {
                    const me = person.user_id === config.userId && !mine;
                    return el('span', { class: `chat-mention${me ? ' chat-mention--me' : ''}`, title: person.name }, part);
                }
            }

            return part;
        });
    }

    function renderMessage(message) {
        if (message.type === 'system') {
            return el('div', { class: 'chat-system', dataset: { id: message.id } },
                el('span', {}, message.text),
                el('time', { datetime: message.created_at }, message.time));
        }

        const roll = message.roll;
        const tone = roll?.success === true ? ' chat-bubble--success' : (roll?.success === false ? ' chat-bubble--failure' : '');

        return el('article', {
            class: `chat-message${message.mine ? ' chat-message--mine' : ''}${message.mentions_me ? ' chat-message--mention' : ''}`,
            dataset: { id: message.id },
        },
        el('header', { class: 'chat-message__meta' },
            el('span', { class: 'chat-message__sender' }, message.sender_name),
            el('time', { datetime: message.created_at }, message.time)),
        el('div', { class: `chat-bubble${tone}` },
            // Abre no visualizador (core/lightbox.js); o link fica para quem abre em nova aba.
            message.image_url ? el('a', { href: message.image_url, target: '_blank', rel: 'noopener noreferrer', class: 'chat-bubble__image', 'data-zoom': message.image_url },
                el('img', { src: message.image_url, alt: 'Imagem enviada', loading: 'lazy', referrerpolicy: 'no-referrer' })) : null,
            message.text ? el('p', { class: 'chat-bubble__text' }, formatText(message.text, message.mine)) : null,
            roll ? el('div', { class: 'chat-roll' },
                el('div', { class: 'chat-roll__head' },
                    el('span', { class: 'chat-roll__formula' }, roll.formula),
                    el('span', { class: 'chat-roll__total' }, icon('dice', 14), String(roll.total ?? '—'))),
                roll.details ? el('span', { class: 'chat-roll__details' }, roll.details) : null,
                roll.success !== null ? el('span', { class: 'chat-roll__outcome' }, roll.success ? 'Sucesso' : 'Falha') : null) : null));
    }

    function nearBottom() {
        return list.scrollHeight - list.scrollTop - list.clientHeight < 80;
    }

    function scrollToBottom(smooth = true) {
        list.scrollTo({ top: list.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    }

    function addMessages(messages) {
        const known = new Set(state.messages.map((message) => message.id));
        const fresh = messages.filter((message) => !known.has(message.id));

        if (fresh.length === 0) return;

        const firstBatch = state.messages.length === 0;
        const stick = firstBatch || nearBottom();
        state.messages.push(...fresh);
        state.messages = state.messages.slice(-200);
        list.append(...fresh.map(renderMessage));

        // Mantém no máximo 200 mensagens na tela.
        while (list.querySelectorAll('[data-id]').length > 200) {
            list.querySelector('[data-id]')?.remove();
        }

        empty.hidden = true;
        state.cursor = Math.max(state.cursor, ...fresh.map((message) => message.id));

        if (state.open && stick) scrollToBottom(!firstBatch);
        updateUnread();
    }

    function resetMessages() {
        state.messages = [];
        state.cursor = 0;
        replace(list, empty);
        empty.hidden = false;
        updateUnread();
    }

    // Não lidas

    function updateUnread() {
        if (state.open) {
            state.lastRead = Math.max(state.lastRead, state.cursor);
            storage(readKey, state.lastRead);
        }

        const unread = state.messages.filter((message) => message.id > state.lastRead && !message.mine).length;

        if (badge) {
            badge.hidden = unread === 0 || state.open;
            badge.textContent = unread > 99 ? '99+' : String(unread);
        }

        // Menu de ações (tools/action-menu.js) mostra o mesmo número.
        document.dispatchEvent(new CustomEvent('tool:badge', { detail: { tool: 'chat', count: state.open ? 0 : unread } }));
    }

    // Polling

    const feed = subscribe(config.pollUrl, {
        interval: CLOSED_INTERVAL,
        params: () => ({ depois: state.cursor || undefined }),
        onData(body) {
            if (state.clearedAt !== undefined && body.cleared_at !== state.clearedAt) {
                // O mestre limpou o chat: recomeça do zero na próxima leitura.
                state.clearedAt = body.cleared_at;
                resetMessages();
                feed.refresh();
                return;
            }

            state.clearedAt = body.cleared_at;
            addMessages(body.messages ?? []);
        },
        onError(failure) {
            if (failure.status === 403) {
                error.textContent = 'Você não tem mais acesso ao chat desta campanha.';
            }
        },
    });

    // Abrir e fechar

    function setOpen(open) {
        state.open = open;
        panel.hidden = !open;
        root.classList.toggle('chat--open', open);
        root.querySelectorAll('[data-chat-toggle]').forEach((button) => button.setAttribute('aria-expanded', String(open)));
        feed.setInterval(open ? OPEN_INTERVAL : CLOSED_INTERVAL);

        if (open) {
            feed.refresh();
            scrollToBottom(false);
            input.focus();
        }

        document.dispatchEvent(new CustomEvent('tool:state', { detail: { tool: 'chat', open } }));
        updateUnread();
    }

    root.querySelectorAll('[data-chat-toggle]').forEach((button) => button.addEventListener('click', () => setOpen(!state.open)));

    // Integração com o menu de ações: abrir pelo botão dele e fechar quando outra ferramenta abre.
    document.addEventListener('tool:toggle', (event) => {
        if (event.detail?.tool === 'chat') setOpen(event.detail.open ?? !state.open);
    });
    document.addEventListener('tool:state', (event) => {
        if (event.detail?.tool !== 'chat' && event.detail?.open && state.open) setOpen(false);
    });

    root.querySelector('[data-chat-expand]')?.addEventListener('click', (event) => {
        const expanded = panel.classList.toggle('chat-panel--expanded');
        event.currentTarget.setAttribute('aria-pressed', String(expanded));
        replace(event.currentTarget, icon(expanded ? 'minimize' : 'maximize', 18));
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && state.open && mentionBox.hidden && !document.querySelector('dialog[open]')) setOpen(false);
    });

    // Limpar (mestre): pede confirmação com um segundo clique em até 3 segundos.

    const clearButton = root.querySelector('[data-chat-clear]');
    let confirmTimer;

    clearButton?.addEventListener('click', async () => {
        if (!clearButton.classList.contains('is-confirming')) {
            clearButton.classList.add('is-confirming');
            clearButton.querySelector('[data-chat-clear-label]').textContent = 'Confirmar?';
            clearButton.querySelector('[data-chat-clear-label]').classList.remove('visually-hidden');
            confirmTimer = setTimeout(() => resetClear(), 3000);
            return;
        }

        clearTimeout(confirmTimer);
        resetClear();
        clearButton.disabled = true;

        try {
            const body = await deleteJson(config.clearUrl);
            state.clearedAt = body.cleared_at;
            resetMessages();
        } catch (failure) {
            error.textContent = failure.message;
        } finally {
            clearButton.disabled = false;
        }
    });

    function resetClear() {
        const label = clearButton.querySelector('[data-chat-clear-label]');
        clearButton.classList.remove('is-confirming');
        label.textContent = 'Limpar o chat';
        label.classList.add('visually-hidden');
    }

    // Menções (@)

    function mentionMatches(query) {
        const term = normalize(query);
        const seen = new Set();

        return participants.filter((person) => person.user_id !== config.userId || person.gm)
            .filter((person) => !term || person.handle.includes(term))
            .filter((person) => {
                const key = `${person.user_id}:${person.handle}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            })
            .slice(0, 8);
    }

    function closeMentions() {
        mentionBox.hidden = true;
        state.mentions = { items: [], index: 0, start: -1 };
    }

    function renderMentions() {
        const { items, index } = state.mentions;

        replace(mentionBox, items.length === 0
            ? el('p', { class: 'chat-mentions__empty' }, 'Nenhum aventureiro ou mestre encontrado.')
            : items.map((person, position) => el('button', {
                type: 'button',
                role: 'option',
                class: `chat-mentions__item${position === index ? ' is-active' : ''}`,
                'aria-selected': String(position === index),
                onMousedown: (event) => event.preventDefault(),
                onClick: () => insertMention(person),
            },
            el('span', { class: `chat-mentions__avatar${person.gm ? ' chat-mentions__avatar--gm' : ''}` }, person.gm ? 'GM' : person.name.slice(0, 2).toUpperCase()),
            el('span', {}, el('strong', {}, person.name), el('small', {}, person.gm ? 'Mestre da Masmorra' : 'Jogador')))));
        mentionBox.hidden = false;
    }

    function updateMentions() {
        const before = input.value.slice(0, input.selectionStart ?? input.value.length);
        const at = before.lastIndexOf('@');
        const query = at === -1 ? null : before.slice(at + 1);

        if (query === null || /\s/.test(query) || (at > 0 && !/\s/.test(before[at - 1]))) {
            closeMentions();
            return;
        }

        state.mentions = { items: mentionMatches(query), index: 0, start: at };
        renderMentions();
    }

    function insertMention(person) {
        const { start } = state.mentions;
        const cursor = input.selectionStart ?? input.value.length;
        const handle = person.name.replace(/\s+/g, '');
        input.value = `${input.value.slice(0, start)}@${handle} ${input.value.slice(cursor)}`;
        const position = start + handle.length + 2;
        input.setSelectionRange(position, position);
        closeMentions();
        input.focus();
        updateSendState();
    }

    // Composição

    function autoGrow() {
        input.style.height = 'auto';
        input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
    }

    function updateSendState() {
        send.disabled = input.value.trim() === '' && !imageFile.files.length && imageUrl.value.trim() === '';
        autoGrow();
    }

    input.addEventListener('input', () => {
        error.textContent = '';
        updateMentions();
        updateSendState();
    });

    input.addEventListener('keydown', (event) => {
        if (!mentionBox.hidden && state.mentions.items.length > 0) {
            const { items } = state.mentions;

            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                state.mentions.index = (state.mentions.index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
                renderMentions();
                return;
            }

            if (event.key === 'Enter' || event.key === 'Tab') {
                event.preventDefault();
                insertMention(items[state.mentions.index]);
                return;
            }
        }

        if (event.key === 'Escape' && !mentionBox.hidden) {
            event.preventDefault();
            event.stopPropagation();
            closeMentions();
            return;
        }

        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            form.requestSubmit();
        }
    });

    input.addEventListener('blur', () => setTimeout(closeMentions, 150));

    root.querySelector('[data-chat-roll-hint]').addEventListener('click', () => {
        if (!input.value.startsWith('/r ')) input.value = `/r ${input.value}`;
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
        updateSendState();
    });

    // Imagem: link ou arquivo.

    function clearAttachment() {
        imageFile.value = '';
        imageUrl.value = '';
        attachment.hidden = true;
        imageRow.hidden = true;
        updateSendState();
    }

    root.querySelector('[data-chat-image-toggle]').addEventListener('click', () => {
        imageRow.hidden = !imageRow.hidden;
        if (!imageRow.hidden) imageUrl.focus();
    });

    imageFile.addEventListener('change', () => {
        const file = imageFile.files[0];

        if (!file) return;

        imageUrl.value = '';
        imageRow.hidden = true;
        attachment.hidden = false;
        attachment.querySelector('[data-chat-attachment-name]').textContent = file.name;
        updateSendState();
    });

    imageUrl.addEventListener('input', updateSendState);
    root.querySelector('[data-chat-attachment-remove]').addEventListener('click', clearAttachment);

    // Envio

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (send.disabled) return;

        const data = new FormData();
        data.append('text', input.value.trim());
        if (imageFile.files[0]) data.append('image', imageFile.files[0]);
        else if (imageUrl.value.trim()) data.append('image_url', imageUrl.value.trim());
        if (config.characterId) data.append('character_id', config.characterId);

        send.disabled = true;
        error.textContent = '';

        try {
            const body = await postJson(config.postUrl, data);
            input.value = '';
            clearAttachment();
            addMessages([body.message]);
            scrollToBottom();
        } catch (failure) {
            error.textContent = failure.message;
        } finally {
            updateSendState();
            input.focus();
        }
    });

    // Link de notificação (?chat=1) abre o chat direto.
    if (new URLSearchParams(window.location.search).get('chat') === '1') {
        setOpen(true);
    }
}

document.querySelectorAll('[data-chat]').forEach(setupChat);
