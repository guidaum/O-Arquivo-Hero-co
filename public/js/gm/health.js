// Vida dos personagens na mesa (HealthTrackerWidget): o servidor aplica o
// dano/cura e devolve PV atual, temporário e máximo; aqui só redesenhamos.
// Também envia personagens para uma masmorra da campanha.

import { request } from '../core/http.js';

function stateOf(current, max) {
    const percent = max > 0 ? (current / max) * 100 : 0;
    if (current <= 0) return 'down';
    if (percent <= 25) return 'critical';
    if (percent <= 50) return 'wounded';
    return 'healthy';
}

function render(card, { current_pv: current, temp_pv: temp, max_pv: max }) {
    const percent = max > 0 ? Math.max(0, Math.min(100, Math.round((current / max) * 100))) : 0;

    card.querySelector('[data-health-current]').textContent = String(current);
    card.querySelector('[data-health-max]').textContent = String(max);
    card.querySelector('[data-health-fill]').style.width = `${percent}%`;
    card.querySelector('[data-health-shield]').style.width = `${max > 0 ? Math.min(100 - percent, Math.round((temp / max) * 100)) : 0}%`;

    const tempLabel = card.querySelector('[data-health-temp]');
    tempLabel.hidden = temp <= 0;
    tempLabel.textContent = `+${temp} temp`;

    card.dataset.state = stateOf(current, max);
}

export function setupHealth(root, { notify }) {
    root.querySelectorAll('[data-health]').forEach((widget) => {
        const card = widget.closest('[data-health-card]');
        const amount = widget.querySelector('[data-health-amount]');
        let busy = false;

        widget.addEventListener('click', async (event) => {
            const button = event.target.closest('[data-health-action]');
            if (!button || busy) return;

            const action = button.dataset.healthAction;
            const needsAmount = ['damage', 'heal', 'temp'].includes(action);
            const value = Number.parseInt(amount.value, 10);

            if (needsAmount && !(value >= 1)) {
                notify('Informe uma quantidade de PV maior que zero.', 'error');
                amount.focus();
                return;
            }

            busy = true;
            widget.setAttribute('aria-busy', 'true');

            try {
                const result = await request(widget.dataset.url, {
                    method: 'PUT',
                    data: { action, amount: needsAmount ? value : null },
                });
                render(card, result);
                notify(result.message, action === 'damage' ? 'danger' : 'success');
            } catch (failure) {
                notify(failure.message, 'error');
            } finally {
                busy = false;
                widget.removeAttribute('aria-busy');
            }
        });
    });
}

export function setupCharacterSpawn(root, { notify }) {
    root.querySelectorAll('[data-spawn-form]').forEach((form) => {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const button = form.querySelector('button[type="submit"]');
            button.disabled = true;

            try {
                const result = await request(form.action, {
                    method: 'POST',
                    data: {
                        map_id: Number(form.elements.map_id.value),
                        hidden: form.elements.hidden.checked,
                    },
                });
                notify(result.message, 'success');
            } catch (failure) {
                notify(failure.message, 'error');
            } finally {
                button.disabled = false;
            }
        });
    });
}
