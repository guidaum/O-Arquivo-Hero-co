// Janela de rolagem (components/roll-dialog.blade.php): formulários com
// [data-roll-dialog] são enviados por fetch e o resultado aparece numa janela,
// sem recarregar a página, então a rolagem da tela fica onde estava. O dado é
// sempre rolado no servidor. Cada resultado também é anunciado com o evento
// "roll:result" (detail = resposta JSON), para a tela atualizar o que mudou
// (ex.: munição no inventário). Sem JavaScript, o formulário é enviado normalmente.

import { request } from '../core/http.js';
import { playEffect, playOutcome } from '../core/sound.js';

const dialog = document.querySelector('[data-roll-dialog-modal]');
const MIN_SPIN = 600;
const OUTCOME_LABELS = {
    critical: 'Acerto Crítico!',
    fumble: 'Falha Crítica!',
    success: 'Sucesso!',
    failure: 'Falha!',
};

// Mesmo interruptor de som e mesmas URLs do rolador do menu de ações.
function soundSettings() {
    let enabled = true;
    let sounds = {};

    try {
        enabled = JSON.parse(window.localStorage.getItem('dice-sound') ?? 'true') !== false;
    } catch (error) {
        enabled = true;
    }

    try {
        const panel = document.querySelector('[data-dice]');
        sounds = panel ? JSON.parse(panel.dataset.config).sounds ?? {} : {};
    } catch (error) {
        sounds = {};
    }

    return { enabled, sounds };
}

if (dialog) {
    const $ = (selector) => dialog.querySelector(selector);
    const title = $('.modal__title');
    const body = $('[data-roll-body]');
    const value = $('[data-roll-value]');
    const label = $('[data-roll-label]');
    const outcome = $('[data-roll-outcome]');
    const detail = $('[data-roll-detail]');
    const note = $('[data-roll-note]');
    const error = $('[data-roll-error]');
    const again = $('[data-roll-again]');

    let last = null;
    let rolling = false;

    async function roll(form, submitter) {
        if (rolling) {
            return;
        }

        rolling = true;
        last = { form, submitter };
        again.disabled = true;
        error.hidden = true;
        note.hidden = true;
        body.dataset.outcome = '';
        body.classList.add('is-rolling');
        value.textContent = '?';
        outcome.textContent = 'Rolando...';
        detail.textContent = '';
        label.textContent = submitter?.title || '';
        title.textContent = form.dataset.rollDialog || form.getAttribute('aria-label') || 'Rolagem';

        if (!dialog.open) {
            dialog.showModal();
        }

        const { enabled, sounds } = soundSettings();
        if (enabled) {
            playEffect('diceRoll', sounds.diceRoll, 0.4);
        }

        // O botão clicado (ex.: difficulty=hard) vai junto, como num envio normal.
        const data = new FormData(form);
        if (submitter?.name) {
            data.set(submitter.name, submitter.value);
        }

        try {
            const [response] = await Promise.all([
                request(form.action, { method: 'POST', data }),
                new Promise((resolve) => setTimeout(resolve, MIN_SPIN)),
            ]);
            const result = response.result ?? {};

            title.textContent = result.title || title.textContent;
            value.textContent = String(result.value ?? '—');
            label.textContent = result.label ?? '';
            outcome.textContent = OUTCOME_LABELS[result.outcome] ?? '';
            outcome.hidden = !result.outcome;
            detail.textContent = result.detail ?? '';
            note.textContent = result.note ?? '';
            note.hidden = !result.note;
            body.dataset.outcome = result.outcome ?? 'neutral';

            if (enabled && result.outcome) {
                playOutcome(result.outcome, sounds);
            }

            document.dispatchEvent(new CustomEvent('roll:result', { detail: response }));
        } catch (exception) {
            value.textContent = '!';
            outcome.hidden = false;
            outcome.textContent = 'Não foi possível rolar';
            body.dataset.outcome = 'error';
            error.textContent = exception.message;
            error.hidden = false;
        } finally {
            body.classList.remove('is-rolling');
            again.disabled = false;
            rolling = false;
        }
    }

    // Em captura: cancela o envio antes da proteção contra duplo envio do
    // layout (core/layout.js), que ignora envios já cancelados.
    document.addEventListener('submit', (event) => {
        const form = event.target;

        if (!(form instanceof HTMLFormElement) || !form.hasAttribute('data-roll-dialog')) {
            return;
        }

        event.preventDefault();
        roll(form, event.submitter instanceof HTMLButtonElement ? event.submitter : null);
    }, true);

    again.addEventListener('click', () => {
        if (last?.form.isConnected) {
            roll(last.form, last.submitter);
        }
    });
}
