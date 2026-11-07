// Comportamento da estrutura da aplicação:
// - menu lateral: recolhe no computador (lembrado no navegador) e abre como gaveta no celular;
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

const root = document.documentElement;
const desktop = window.matchMedia('(min-width: 1024px)');

function setStored(key, value) {
    try {
        window.localStorage.setItem(key, value);
    } catch (error) {
        // Armazenamento indisponível: o estado vale só para esta página.
    }
}

function setSidebarButtons(expanded) {
    document.querySelectorAll('[data-sidebar-toggle]').forEach((button) => {
        button.setAttribute('aria-expanded', String(expanded));
    });
}

function closeMobileSidebar() {
    root.classList.remove('sidebar-open');
    setSidebarButtons(false);
}

function syncSidebarButtons() {
    setSidebarButtons(desktop.matches ? !root.classList.contains('sidebar-collapsed') : root.classList.contains('sidebar-open'));
}

document.querySelectorAll('[data-sidebar-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
        if (desktop.matches) {
            const collapsed = root.classList.toggle('sidebar-collapsed');
            setStored('sidebarCollapsed', collapsed ? '1' : '0');
        } else {
            root.classList.toggle('sidebar-open');
        }

        syncSidebarButtons();
    });
});

document.querySelectorAll('[data-sidebar-close]').forEach((element) => {
    element.addEventListener('click', closeMobileSidebar);
});

// Ao escolher um item no celular, a gaveta fecha.
document.querySelectorAll('.sidebar a').forEach((link) => {
    link.addEventListener('click', () => {
        if (!desktop.matches) {
            closeMobileSidebar();
        }
    });
});

desktop.addEventListener('change', () => {
    root.classList.remove('sidebar-open');
    syncSidebarButtons();
});

syncSidebarButtons();

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
