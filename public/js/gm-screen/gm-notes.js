// Notas do mestre (gm_notes): salvam sozinhas 1,5 s depois da última tecla,
// ao sair do campo e ao clicar em "Salvar agora". Avisa antes de fechar a
// página com alterações ainda não salvas.

import { request } from '../core/http.js';

const DELAY = 1500;

export function setupGmNotes(root, notify) {
    const form = root.querySelector('[data-gm-notes]');
    if (!form) return;

    const field = form.elements.gm_notes;
    const status = form.querySelector('[data-gm-notes-status]');
    let saved = field.value;
    let timer;
    let saving = null;

    async function save() {
        clearTimeout(timer);
        if (field.value === saved) return;
        if (saving) { await saving; return save(); }

        const value = field.value;
        status.textContent = 'Salvando...';

        saving = request(form.action, { method: 'PUT', data: { gm_notes: value } })
            .then((body) => {
                saved = value;
                status.textContent = field.value === saved ? `Salvo às ${body.saved_at}.` : 'Alterações não salvas...';
            })
            .catch((failure) => {
                status.textContent = 'Não foi possível salvar. Tente "Salvar agora".';
                notify(failure.message, 'error');
            })
            .finally(() => { saving = null; });

        return saving;
    }

    field.addEventListener('input', () => {
        status.textContent = 'Alterações não salvas...';
        clearTimeout(timer);
        timer = setTimeout(save, DELAY);
    });
    field.addEventListener('blur', save);
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        save();
    });

    window.addEventListener('beforeunload', (event) => {
        if (field.value !== saved) event.preventDefault();
    });
}
