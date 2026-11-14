// Transporte único de tempo real. Hoje é polling: o navegador pergunta ao
// servidor o que mudou desde o último cursor conhecido. Se o servidor novo
// aceitar WebSocket, só este módulo muda; as telas continuam usando
// subscribe() do mesmo jeito.
//
// const feed = subscribe(url, {
//     interval: 4000,                       // intervalo com a aba visível (ms)
//     params: () => ({ depois: cursor }),  // consulta enviada a cada pedido
//     onData: (body) => { ... },            // resposta JSON do servidor
//     onError: (error) => { ... },          // opcional
// });
// feed.refresh();          // pede agora (ex.: logo após enviar uma mensagem)
// feed.setInterval(15000); // muda o ritmo (ex.: chat fechado)
// feed.stop();
//
// Pulso (App\Support\Pulse): quando a resposta traz "pulse" ({channel, token}),
// os ciclos seguintes perguntam só à rota leve /pulso (sem sessão nem banco)
// se a senha do canal mudou, num único pedido para todos os canais da página.
// O endpoint completo, que usa o banco, só é chamado quando a senha muda, no
// refresh() e numa conferência a cada FULL_CHECK (rede de segurança). A
// hospedagem limita as conexões ao banco por hora; o "nada mudou" não abre
// nenhuma.
//
// O estado da conexão é anunciado no document, e public/js/core/connection.js
// mostra o aviso no layout: evento 'realtime:status' com detail
// { feed, state: 'online' | 'unstable' | 'expired' | 'forbidden', status }.

import { getJson } from './http.js';

const HIDDEN_INTERVAL = 30000;
const MAX_BACKOFF = 60000;
// Falhas seguidas antes de avisar que a conexão está instável (uma só é ruído).
const UNSTABLE_AFTER = 2;
// Conferência completa periódica, mesmo sem mudança no pulso.
const FULL_CHECK = 5 * 60 * 1000;
// Pedidos de pulso dentro desta janela saem juntos.
const BATCH_DELAY = 60;

let feeds = 0;

function announce(feed, state, status = null) {
    document.dispatchEvent(new CustomEvent('realtime:status', { detail: { feed, state, status } }));
}

// Pulso em lote: vários canais, um pedido.

const pulseUrl = () => document.querySelector('meta[name="pulse-url"]')?.content ?? '/pulso';
let pending = new Map();
let batchTimer = null;

function flushPulse() {
    const batch = pending;
    pending = new Map();
    batchTimer = null;

    const target = new URL(pulseUrl(), window.location.href);
    batch.forEach((_, channel) => target.searchParams.append('c[]', channel));

    fetch(target, { credentials: 'omit', headers: { Accept: 'application/json' }, cache: 'no-store' })
        .then((response) => {
            if (!response.ok) throw Object.assign(new Error('Pulso indisponível.'), { status: response.status });

            return response.json();
        })
        .then((body) => batch.forEach((waiters, channel) => waiters.forEach(({ resolve }) => resolve(body.tokens?.[channel] ?? null))))
        .catch((error) => batch.forEach((waiters) => waiters.forEach(({ reject }) => reject(error))));
}

function pulseToken(channel) {
    return new Promise((resolve, reject) => {
        if (!pending.has(channel)) pending.set(channel, []);
        pending.get(channel).push({ resolve, reject });
        batchTimer ??= setTimeout(flushPulse, BATCH_DELAY);
    });
}

export function subscribe(url, { interval = 5000, params = () => ({}), onData, onError } = {}) {
    // Página dentro de um popup (html.is-embedded, theme-init.js): quem consulta
    // é a tela de fora; aqui nada é pedido, para não dobrar o polling.
    if (document.documentElement.classList.contains('is-embedded')) {
        return { refresh() {}, setInterval() {}, stop() {} };
    }

    const feed = ++feeds;
    let current = interval;
    let failures = 0;
    let timer = null;
    let running = false;
    let stopped = false;
    let pulse = null;
    let lastFull = 0;

    const delay = () => {
        const base = document.hidden ? Math.max(current, HIDDEN_INTERVAL) : current;

        return failures === 0 ? base : Math.min(MAX_BACKOFF, base * 2 ** failures);
    };

    const schedule = () => {
        clearTimeout(timer);
        if (!stopped) timer = setTimeout(() => tick(false), delay());
    };

    // Com pulso: pergunta só se a senha mudou. true = precisa buscar o completo.
    async function changed() {
        if (!pulse || Date.now() - lastFull >= FULL_CHECK) return true;

        const token = await pulseToken(pulse.channel);

        return token === null || token !== pulse.token;
    }

    async function tick(force) {
        if (stopped || running) return;
        running = true;

        try {
            if (force || await changed()) {
                const body = await getJson(url, params());
                lastFull = Date.now();
                pulse = body?.pulse?.channel ? body.pulse : null;
                onData?.(body);
            }

            if (failures >= UNSTABLE_AFTER) announce(feed, 'online');
            failures = 0;
        } catch (error) {
            failures = Math.min(failures + 1, 5);
            onError?.(error);

            // Sessão expirada ou acesso removido: não adianta insistir.
            if (error.status === 401 || error.status === 419) {
                stopped = true;
                announce(feed, 'expired', error.status);
            } else if (error.status === 403) {
                stopped = true;
                announce(feed, 'forbidden', error.status);
            } else if (failures === UNSTABLE_AFTER) {
                // Sem resposta (rede) ou erro do servidor: segue tentando, com recuo.
                announce(feed, 'unstable', error.status ?? null);
            }
        } finally {
            running = false;
            schedule();
        }
    }

    // Aba visível de novo: confere logo (pelo pulso, sem forçar o completo).
    const onVisibility = () => {
        if (!document.hidden) {
            clearTimeout(timer);
            tick(false);
        }
    };

    // Pedido explícito da tela (ex.: depois de enviar algo): sempre o completo.
    function refresh() {
        clearTimeout(timer);
        tick(true);
    }

    document.addEventListener('visibilitychange', onVisibility);
    tick(true);

    return {
        refresh,
        setInterval(ms) {
            if (ms === current) return;
            current = ms;
            schedule();
        },
        stop() {
            if (failures >= UNSTABLE_AFTER) announce(feed, 'online');
            stopped = true;
            clearTimeout(timer);
            document.removeEventListener('visibilitychange', onVisibility);
        },
    };
}
