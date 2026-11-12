// Aplica o tema e o estado do menu lateral antes da renderização, evitando
// o "piscar" da tela. Carregado de forma síncrona no <head>; o restante fica
// em theme.js e layout.js.
//
// Como no sistema antigo, no celular o site sempre abre no tema claro.
(function () {
    var root = document.documentElement;

    // Página aberta dentro de um popup de outra tela (ex.: ficha no battlemap):
    // sem menu, cabeçalho nem ferramentas (responsive.css), e sem polling (realtime.js).
    try {
        if (window.self !== window.top) {
            root.classList.add('is-embedded');
        }
    } catch (error) {
        root.classList.add('is-embedded');
    }
    var isMobile = window.innerWidth < 768
        || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    try {
        if (isMobile || window.localStorage.getItem('theme') === 'light') {
            root.classList.add('light');
        }

        if (window.localStorage.getItem('sidebarCollapsed') === '1') {
            root.classList.add('sidebar-collapsed');
        }
    } catch (error) {
        // Armazenamento indisponível: tema escuro e menu aberto.
        if (isMobile) {
            root.classList.add('light');
        }
    }
})();
