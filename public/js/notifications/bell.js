// Sino de notificações (NotificationBell.tsx): as últimas menções ao usuário
// no chat, consultadas por core/realtime.js. Abrir o sino marca tudo como lido.

import { subscribe } from '../core/realtime.js';
import { postJson } from '../core/http.js';
import { el, replace } from '../core/dom.js';

const POLL_INTERVAL = 30000;
const bell = document.querySelector('[data-notifications]');

if (bell) {
    const dot = bell.querySelector('[data-notifications-dot]');
    const list = bell.querySelector('[data-notifications-list]');
    let unread = 0;

    function render(items) {
        replace(list, items.length === 0
            ? el('p', { class: 'notifications__empty' }, 'Silêncio absoluto...')
            : items.map((item) => el(item.url ? 'a' : 'div', { class: 'notifications__item', href: item.url ?? null },
                el('span', { class: 'notifications__meta' },
                    el('strong', {}, item.sender_name),
                    el('time', {}, item.time)),
                el('span', { class: 'notifications__text' }, `"${item.text}"`),
                el('span', { class: 'notifications__session' }, item.session ?? '', item.url ? ' · Ver no chat' : ''))));
    }

    function setUnread(count) {
        unread = count;
        dot.hidden = count === 0;
        bell.querySelector('summary').setAttribute('aria-label', count > 0 ? `Notificações (${count} novas)` : 'Notificações');
    }

    subscribe(bell.dataset.url, {
        interval: POLL_INTERVAL,
        onData(body) {
            render(body.items ?? []);
            setUnread(body.unread ?? 0);
        },
    });

    bell.addEventListener('toggle', () => {
        if (bell.open && unread > 0) {
            setUnread(0);
            postJson(bell.dataset.readUrl, {}).catch(() => {});
        }
    });
}
