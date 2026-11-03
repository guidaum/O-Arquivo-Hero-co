// Aplica o tema salvo antes da renderização, evitando o "piscar" do tema errado.
// Carregado de forma síncrona no <head>; o restante do tema fica em theme.js.
(function () {
    try {
        if (window.localStorage.getItem('theme') === 'light') {
            document.documentElement.classList.add('light');
        }
    } catch (error) {
        // Armazenamento indisponível: mantém o tema escuro padrão.
    }
})();
