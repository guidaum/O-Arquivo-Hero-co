// Aviso de conexão do layout ([data-connection-banner]). Escuta o evento
// 'realtime:status' de public/js/core/realtime.js e os eventos online/offline
// do navegador:
// - expired: a sessão acabou (401/419); o polling parou e só recarregar resolve;
// - forbidden: o acesso a algo desta tela foi removido (403), por exemplo
//   o jogador saiu da campanha;
// - unstable: alguma consulta falha seguidamente; some sozinho quando todas
//   voltam a responder.
// Expired e forbidden ficam até recarregar; têm prioridade sobre unstable.

const banner = document.querySelector('[data-connection-banner]');

if (banner) {
    const text = banner.querySelector('[data-connection-text]');
    const reload = banner.querySelector('[data-connection-reload]');
    const unstable = new Set();
    let blocking = null;
    let offline = !navigator.onLine;

    const MESSAGES = {
        expired: 'Sua sessão expirou. Recarregue a página para continuar recebendo as novidades da mesa.',
        forbidden: 'Seu acesso a parte desta tela mudou. Recarregue a página para ver a versão atual.',
        offline: 'Você está sem internet. As novidades da mesa voltam assim que a conexão retornar.',
        unstable: 'Conexão instável com o servidor. Tentando reconectar…',
    };

    const render = () => {
        const state = blocking ?? (offline ? 'offline' : (unstable.size > 0 ? 'unstable' : null));

        banner.hidden = state === null;
        banner.dataset.state = state ?? '';
        if (state === null) return;

        text.textContent = MESSAGES[state];
        reload.hidden = state === 'unstable' || state === 'offline';
    };

    document.addEventListener('realtime:status', (event) => {
        const { feed, state } = event.detail ?? {};

        if (state === 'expired' || state === 'forbidden') {
            // Sessão expirada vale mais que acesso removido: diz o que fazer.
            if (blocking !== 'expired') blocking = state;
            unstable.delete(feed);
        } else if (state === 'unstable') {
            unstable.add(feed);
        } else if (state === 'online') {
            unstable.delete(feed);
        }

        render();
    });

    window.addEventListener('offline', () => {
        offline = true;
        render();
    });

    window.addEventListener('online', () => {
        offline = false;
        render();
    });

    reload.addEventListener('click', () => window.location.reload());

    render();
}
