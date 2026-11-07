// Menu de Ações (ActionMenu.tsx): botão central que abre em leque o
// Rolador de Dados, o Chat da Sessão e as Anotações Rápidas.
//
// Protocolo entre as ferramentas (documento):
// - tool:toggle { tool, open? }  pede para abrir/fechar uma ferramenta;
// - tool:state  { tool, open }   a ferramenta avisa que abriu/fechou
//                                (as outras fecham: só uma aberta por vez);
// - tool:badge  { tool, count }  número no botão (ex.: mensagens não lidas).

const menu = document.querySelector('[data-action-menu]');

if (menu) {
    const toggle = menu.querySelector('[data-action-toggle]');
    const options = menu.querySelector('[data-action-options]');
    const toast = menu.querySelector('[data-action-toast]');
    const openTools = new Set();
    let toastTimer;

    function setExpanded(expanded) {
        options.hidden = !expanded;
        menu.classList.toggle('action-menu--expanded', expanded);
        toggle.setAttribute('aria-expanded', String(expanded));
    }

    function showToast(text) {
        toast.textContent = text;
        toast.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { toast.hidden = true; }, 3500);
    }

    toggle.addEventListener('click', () => setExpanded(options.hidden));

    menu.querySelectorAll('[data-tool-open]').forEach((button) => {
        button.addEventListener('click', () => {
            setExpanded(false);

            if (button.dataset.toolUnavailable) {
                showToast(button.dataset.toolUnavailable);
                return;
            }

            document.dispatchEvent(new CustomEvent('tool:toggle', { detail: { tool: button.dataset.toolOpen } }));
        });
    });

    menu.querySelectorAll('[data-tool-close]').forEach((button) => {
        button.addEventListener('click', () => {
            document.dispatchEvent(new CustomEvent('tool:toggle', { detail: { tool: button.dataset.toolClose, open: false } }));
        });
    });

    document.addEventListener('tool:state', (event) => {
        const { tool, open } = event.detail ?? {};

        if (open) openTools.add(tool);
        else openTools.delete(tool);

        menu.querySelectorAll(`[data-tool-open="${tool}"]`).forEach((button) => button.classList.toggle('is-active', Boolean(open)));
        menu.classList.toggle('action-menu--tool-open', openTools.size > 0);
    });

    document.addEventListener('tool:badge', (event) => {
        const { tool, count } = event.detail ?? {};

        menu.querySelectorAll(`[data-tool-badge="${tool}"]`).forEach((badge) => {
            badge.hidden = !count;
            badge.textContent = count > 99 ? '99+' : String(count);
        });
    });

    // Fecha o leque ao clicar fora; Esc fecha o leque ou a ferramenta aberta.
    document.addEventListener('click', (event) => {
        if (!options.hidden && !menu.querySelector('[data-action-fab]').contains(event.target)) setExpanded(false);
    });

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' || document.querySelector('dialog[open]')) return;

        if (!options.hidden) {
            setExpanded(false);
        } else if (openTools.size > 0 && !event.target.closest?.('[data-chat]')) {
            openTools.forEach((tool) => document.dispatchEvent(new CustomEvent('tool:toggle', { detail: { tool, open: false } })));
        }
    });
}
