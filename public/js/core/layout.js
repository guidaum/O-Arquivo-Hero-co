// Comportamento da estrutura da aplicação:
// - menu lateral: recolhe no computador (lembrado no navegador) e abre como gaveta no celular;
// - abas roláveis (.tabs) mostram a aba atual; formulários POST não são enviados duas vezes;
// - menus suspensos (<details data-dropdown>): fecham ao clicar fora ou com Esc;
// - janelas modais (<dialog>): abrem com [data-modal-open="id"] e fecham com
//   [data-modal-close], Esc ou clique fora da janela. Uma mesma janela de
//   confirmação serve a vários itens: o botão que abre informa o destino do
//   formulário (data-modal-action) e os textos (data-modal-text-<nome>), que
//   preenchem form[data-modal-form] e os elementos [data-modal-text="<nome>"];
//   data-modal-value-<nome> preenche o campo [data-modal-value="<nome>"];
// - campos [data-autosubmit] enviam o formulário ao mudar de valor;
// - botões [data-check-all="<seletor>"] marcam todas as caixas do seletor;
// - botões [data-copy="<texto>"] copiam o texto para a área de transferência.

import { scrollIntoBar } from './dom.js';

const root = document.documentElement;
const desktop = window.matchMedia('(min-width: 1024px)');

function setStored(key, value) {
    try {
        window.localStorage.setItem(key, value);
    } catch (error) {
        // Armazenamento indisponível: o estado vale só para esta página.
    }
}

// Menu lateral. No computador ele recolhe para só ícones; no tablet e no
// celular é uma gaveta: enquanto fechada fica inerte (fora da ordem de Tab),
// ao abrir trava a rolagem da página e leva o foco ao item atual, e ao fechar
// devolve o foco a quem a abriu. Deslizar para a esquerda também fecha.

const sidebar = document.getElementById('sidebar');
let sidebarOpener = null;

function setSidebarButtons(expanded) {
    document.querySelectorAll('[data-sidebar-toggle]').forEach((button) => {
        button.setAttribute('aria-expanded', String(expanded));
    });
}

function syncSidebar() {
    const drawerOpen = root.classList.contains('sidebar-open');

    setSidebarButtons(desktop.matches ? !root.classList.contains('sidebar-collapsed') : drawerOpen);

    if (sidebar) {
        sidebar.inert = !desktop.matches && !drawerOpen;
    }
}

function openMobileSidebar(opener) {
    sidebarOpener = opener ?? null;
    root.classList.add('sidebar-open');
    syncSidebar();

    const target = sidebar?.querySelector('[aria-current="page"]') ?? sidebar?.querySelector('a, button');
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: 'nearest' });
}

function closeMobileSidebar({ restoreFocus = true } = {}) {
    if (!root.classList.contains('sidebar-open')) {
        return;
    }

    root.classList.remove('sidebar-open');
    syncSidebar();

    if (restoreFocus) {
        sidebarOpener?.focus({ preventScroll: true });
    }

    sidebarOpener = null;
}

document.querySelectorAll('[data-sidebar-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
        if (desktop.matches) {
            const collapsed = root.classList.toggle('sidebar-collapsed');
            setStored('sidebarCollapsed', collapsed ? '1' : '0');
            syncSidebar();
        } else if (root.classList.contains('sidebar-open')) {
            closeMobileSidebar();
        } else {
            openMobileSidebar(button);
        }
    });
});

document.querySelectorAll('[data-sidebar-close]').forEach((element) => {
    element.addEventListener('click', () => closeMobileSidebar());
});

// Ao escolher um item no celular, a gaveta fecha (a página nova assume o foco).
sidebar?.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
        if (!desktop.matches) {
            closeMobileSidebar({ restoreFocus: false });
        }
    });
});

// Deslizar a gaveta para a esquerda fecha o menu.
if (sidebar) {
    let touchStart = null;

    sidebar.addEventListener('touchstart', (event) => {
        const touch = event.touches[0];
        touchStart = event.touches.length === 1 ? { x: touch.clientX, y: touch.clientY } : null;
    }, { passive: true });

    sidebar.addEventListener('touchend', (event) => {
        if (!touchStart || desktop.matches) {
            return;
        }

        const touch = event.changedTouches[0];
        const dx = touch.clientX - touchStart.x;
        const dy = Math.abs(touch.clientY - touchStart.y);
        touchStart = null;

        if (dx < -60 && dy < Math.abs(dx)) {
            closeMobileSidebar();
        }
    }, { passive: true });
}

desktop.addEventListener('change', () => {
    root.classList.remove('sidebar-open');
    syncSidebar();
});

syncSidebar();

// Abas roláveis (.tabs): no celular a aba atual pode ficar fora da área
// visível; ela é trazida para perto do centro ao abrir a página.
document.querySelectorAll('.tabs').forEach((tabs) => {
    scrollIntoBar(tabs, tabs.querySelector('[aria-current="page"], [aria-selected="true"]'));
});

// Atalhos de seções ([data-scrollspy] com links "#id"): o link da seção que
// está na tela recebe aria-current e a barra rola até ele.
document.querySelectorAll('[data-scrollspy]').forEach((nav) => {
    const links = new Map();

    nav.querySelectorAll('a[href^="#"]').forEach((link) => {
        const section = document.getElementById(decodeURIComponent(link.hash.slice(1)));

        if (section) {
            links.set(section, link);
        }
    });

    if (links.size === 0 || !('IntersectionObserver' in window)) {
        return;
    }

    const visible = new Set();
    let previous = null;

    const mark = () => {
        const current = [...links.keys()].find((section) => visible.has(section));

        if (current === undefined || current === previous) {
            return;
        }

        previous = current;

        links.forEach((link, section) => {
            if (section === current) {
                link.setAttribute('aria-current', 'location');
                scrollIntoBar(nav, link, 'smooth');
            } else {
                link.removeAttribute('aria-current');
            }
        });
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                visible.add(entry.target);
            } else {
                visible.delete(entry.target);
            }
        });
        mark();
    }, { rootMargin: '-35% 0px -55% 0px' });

    links.forEach((link, section) => observer.observe(section));
});

// Envio de formulários que trocam de página: o botão usado mostra que está
// trabalhando e um segundo toque não reenvia (evita compras ou registros
// duplicados em conexões lentas). Formulários tratados por fetch chamam
// preventDefault e não são afetados; o estado é desfeito ao voltar à página.

const busyButtons = new Set();

function clearBusy() {
    busyButtons.forEach((button) => {
        button.classList.remove('is-busy');
        button.removeAttribute('aria-busy');
        button.form?.removeAttribute('data-submitting');
    });
    busyButtons.clear();
}

document.addEventListener('submit', (event) => {
    const form = event.target;

    if (!(form instanceof HTMLFormElement) || event.defaultPrevented || form.method !== 'post' || form.target === '_blank') {
        return;
    }

    if (form.hasAttribute('data-submitting')) {
        event.preventDefault();
        return;
    }

    form.setAttribute('data-submitting', '');

    const button = event.submitter instanceof HTMLButtonElement ? event.submitter : null;

    if (button) {
        button.classList.add('is-busy');
        button.setAttribute('aria-busy', 'true');
        busyButtons.add(button);
    }

    // Respostas que não trocam de página (ex.: downloads) liberam o formulário.
    window.setTimeout(clearBusy, 8000);
});

window.addEventListener('pageshow', clearBusy);

// Menus suspensos

const dropdowns = () => document.querySelectorAll('details[data-dropdown]');

document.addEventListener('click', (event) => {
    dropdowns().forEach((dropdown) => {
        if (dropdown.open && !dropdown.contains(event.target)) {
            dropdown.open = false;
        }
    });
});

dropdowns().forEach((dropdown) => {
    const summary = dropdown.querySelector('summary');

    dropdown.addEventListener('toggle', () => {
        summary?.setAttribute('aria-expanded', String(dropdown.open));
    });
});

document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') {
        return;
    }

    dropdowns().forEach((dropdown) => {
        if (dropdown.open) {
            dropdown.open = false;
            dropdown.querySelector('summary')?.focus();
        }
    });

    if (root.classList.contains('sidebar-open')) {
        closeMobileSidebar();
    }
});

// Janelas modais

document.addEventListener('click', (event) => {
    const opener = event.target.closest('[data-modal-open]');

    if (opener) {
        const dialog = document.getElementById(opener.dataset.modalOpen);

        if (dialog instanceof HTMLDialogElement) {
            event.preventDefault();
            fillModal(dialog, opener.dataset);
            dialog.showModal();
        }

        return;
    }

    const closer = event.target.closest('[data-modal-close]');

    if (closer) {
        closer.closest('dialog')?.close();
        return;
    }

    // Clique no fundo escurecido (fora da caixa da janela).
    if (event.target instanceof HTMLDialogElement && event.target.open) {
        const box = event.target.getBoundingClientRect();
        const inside = event.clientX >= box.left && event.clientX <= box.right
            && event.clientY >= box.top && event.clientY <= box.bottom;

        if (!inside) {
            event.target.close();
        }
    }
});

function fillModal(dialog, data) {
    const form = dialog.querySelector('form[data-modal-form]');

    if (form && data.modalAction) {
        form.action = data.modalAction;
    }

    // Imagem ampliada (ex.: galeria do diário): data-modal-image no botão que abre.
    if (data.modalImage) {
        dialog.querySelectorAll('img[data-modal-image]').forEach((image) => {
            image.src = data.modalImage;
        });
    }

    // Campos pré-preenchidos: data-modal-value-<nome> no botão, [data-modal-value="<nome>"] no campo.
    dialog.querySelectorAll('[data-modal-value]').forEach((field) => {
        const key = 'modalValue' + field.dataset.modalValue.charAt(0).toUpperCase() + field.dataset.modalValue.slice(1);

        if (key in data) {
            field.value = data[key];
        }
    });

    dialog.querySelectorAll('[data-modal-text]').forEach((element) => {
        const key = 'modalText' + element.dataset.modalText.charAt(0).toUpperCase() + element.dataset.modalText.slice(1);

        if (key in data) {
            element.textContent = data[key];
        }
    });
}

// Abre automaticamente a janela que voltou com erros de validação.
document.querySelectorAll('dialog[data-modal-open-on-load]').forEach((dialog) => {
    dialog.showModal();
});

// Envio automático (ex.: filtros e troca de papel)

document.addEventListener('change', (event) => {
    const field = event.target.closest('[data-autosubmit]');

    field?.form?.requestSubmit();
});

// "Marcar todos"

document.querySelectorAll('[data-check-all]').forEach((button) => {
    button.addEventListener('click', () => {
        document.querySelectorAll(button.dataset.checkAll).forEach((checkbox) => {
            checkbox.checked = true;
        });
    });
});

// Copiar texto ([data-copy="texto"]): o botão mostra um "ok" por 2 segundos.

document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-copy]');

    if (!button) return;

    try {
        await navigator.clipboard.writeText(button.dataset.copy);
        button.classList.add('is-copied');
        button.setAttribute('title', 'Copiado!');
        setTimeout(() => {
            button.classList.remove('is-copied');
            button.setAttribute('title', 'Copiar');
        }, 2000);
    } catch (error) {
        // Sem acesso à área de transferência (ex.: página sem HTTPS): o texto continua visível para cópia manual.
    }
});
