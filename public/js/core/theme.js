// Alternância entre tema escuro (padrão) e claro.
// Uso: <button type="button" data-theme-toggle>…</button>
// O ícone (sol/lua) é trocado pelo CSS conforme a classe .light do <html>.

const STORAGE_KEY = 'theme';
const root = document.documentElement;

function currentTheme() {
    return root.classList.contains('light') ? 'light' : 'dark';
}

function updateButtons(theme) {
    const label = theme === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro';

    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
        button.setAttribute('aria-pressed', String(theme === 'light'));
        button.setAttribute('aria-label', label);
        button.title = label;
    });
}

// Cor da barra do navegador no celular acompanha o fundo do tema.
function syncThemeColor() {
    const meta = document.querySelector('meta[name="theme-color"]');
    const color = getComputedStyle(root).getPropertyValue('--bg-primary').trim();

    if (meta && color) {
        meta.setAttribute('content', color);
    }
}

function applyTheme(theme) {
    root.classList.toggle('light', theme === 'light');
    syncThemeColor();

    try {
        window.localStorage.setItem(STORAGE_KEY, theme);
    } catch (error) {
        // Armazenamento indisponível: o tema vale só para esta página.
    }

    updateButtons(theme);
}

document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
        applyTheme(currentTheme() === 'light' ? 'dark' : 'light');
    });
});

// Página embutida (ficha no painel ou no popup do mapa): segue o tema da
// página de fora, inclusive quando ele é trocado com a ficha aberta.
try {
    if (root.classList.contains('is-embedded') && window.parent !== window) {
        const outer = window.parent.document.documentElement;
        const follow = () => {
            root.classList.toggle('light', outer.classList.contains('light'));
            updateButtons(currentTheme());
        };

        new MutationObserver(follow).observe(outer, { attributes: true, attributeFilter: ['class'] });
        follow();
    }
} catch (error) {
    // Página de fora de outra origem: fica o tema salvo neste navegador.
}

updateButtons(currentTheme());
syncThemeColor();
