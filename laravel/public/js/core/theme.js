// Alternância entre tema escuro (padrão) e claro.
// Uso: <button type="button" data-theme-toggle>…</button>

const STORAGE_KEY = 'theme';
const root = document.documentElement;

function currentTheme() {
    return root.classList.contains('light') ? 'light' : 'dark';
}

function applyTheme(theme) {
    root.classList.toggle('light', theme === 'light');

    try {
        window.localStorage.setItem(STORAGE_KEY, theme);
    } catch (error) {
        // Armazenamento indisponível: o tema vale só para esta página.
    }

    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
        button.setAttribute('aria-pressed', String(theme === 'light'));
        button.textContent = theme === 'light' ? 'Tema escuro' : 'Tema claro';
    });
}

document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
        applyTheme(currentTheme() === 'light' ? 'dark' : 'light');
    });
});

applyTheme(currentTheme());
