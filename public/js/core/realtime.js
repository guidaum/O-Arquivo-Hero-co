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

import { getJson } from './http.js';

const HIDDEN_INTERVAL = 30000;
const MAX_BACKOFF = 60000;

export function subscribe(url, { interval = 5000, params = () => ({}), onData, onError } = {}) {
    // Página dentro de um popup (html.is-embedded, theme-init.js): quem consulta
    // é a tela de fora; aqui nada é pedido, para não dobrar o polling.
    if (document.documentElement.classList.contains('is-embedded')) {
        return { refresh() {}, setInterval() {}, stop() {} };
    }

    let current = interval;
    let failures = 0;
    let timer = null;
    let running = false;
    let stopped = false;

    const delay = () => {
        const base = document.hidden ? Math.max(current, HIDDEN_INTERVAL) : current;

        return failures === 0 ? base : Math.min(MAX_BACKOFF, base * 2 ** failures);
    };

    const schedule = () => {
        clearTimeout(timer);
        if (!stopped) timer = setTimeout(tick, delay());
    };

    async function tick() {
        if (stopped || running) return;
        running = true;

        try {
            onData?.(await getJson(url, params()));
            failures = 0;
        } catch (error) {
            failures = Math.min(failures + 1, 5);
            onError?.(error);

            // Sessão expirada ou acesso removido: não adianta insistir.
            if (error.status === 401 || error.status === 403 || error.status === 419) {
                stopped = true;
            }
        } finally {
            running = false;
            schedule();
        }
    }

    const onVisibility = () => {
        if (!document.hidden) refresh();
    };

    function refresh() {
        clearTimeout(timer);
        tick();
    }

    document.addEventListener('visibilitychange', onVisibility);
    tick();

    return {
        refresh,
        setInterval(ms) {
            if (ms === current) return;
            current = ms;
            schedule();
        },
        stop() {
            stopped = true;
            clearTimeout(timer);
            document.removeEventListener('visibilitychange', onVisibility);
        },
    };
}
