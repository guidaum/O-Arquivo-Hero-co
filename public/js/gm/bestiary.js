// Bestiário: filtros por nome, ambiente e tipo, rolagem do dano das ações
// no rolador de dados (evento dice:roll) e envio de criaturas para a masmorra.

import { postJson } from '../core/http.js';

const MAX_DICE = 20;
const SIDES = [4, 6, 8, 10, 12, 20, 100];

// "2d6+3" → { quantity: 2, sides: 6, modifier: 3 }
export function parseDamage(formula) {
    const match = /^\s*(\d+)\s*d\s*(\d+)\s*(?:([+-])\s*(\d+))?\s*$/i.exec(formula ?? '');
    if (!match) return null;

    return {
        quantity: Number(match[1]),
        sides: Number(match[2]),
        modifier: match[4] ? Number(match[4]) * (match[3] === '-' ? -1 : 1) : 0,
    };
}

export async function spawnMonsters(url, target, monsters, notify) {
    if (!target) {
        notify('Cadastre ou ative uma masmorra para colocar criaturas.', 'error');
        return false;
    }

    try {
        const result = await postJson(url, { map_id: target.mapId, hidden: target.hidden, monsters });
        notify(result.message, 'success');
        return true;
    } catch (failure) {
        notify(failure.message, 'error');
        return false;
    }
}

export function setupBestiary(root, { config, notify, spawnTarget }) {
    const bestiary = root.querySelector('[data-bestiary]');
    if (!bestiary) return;

    const search = bestiary.querySelector('[data-bestiary-search]');
    const environment = bestiary.querySelector('[data-bestiary-environment]');
    const type = bestiary.querySelector('[data-bestiary-type]');
    const count = bestiary.querySelector('[data-bestiary-count]');
    const empty = bestiary.querySelector('[data-bestiary-empty]');
    const cards = [...bestiary.querySelectorAll('[data-monster]')];

    function filter() {
        const term = search.value.trim().toLowerCase();
        let visible = 0;

        cards.forEach((card) => {
            const show = (!term || card.dataset.name.includes(term))
                && (!environment.value || card.dataset.environments.split(' ').includes(environment.value))
                && (!type.value || card.dataset.type === type.value);
            card.hidden = !show;
            if (show) visible += 1;
        });

        count.textContent = `${visible} ${visible === 1 ? 'criatura' : 'criaturas'}`;
        empty.hidden = visible > 0;
    }

    search.addEventListener('input', filter);
    environment.addEventListener('change', filter);
    type.addEventListener('change', filter);

    bestiary.addEventListener('click', async (event) => {
        const roll = event.target.closest('[data-roll-damage]');
        if (roll) {
            const dice = parseDamage(roll.dataset.rollDamage);
            if (!dice || !SIDES.includes(dice.sides)) {
                notify('Esta fórmula de dano não pode ir para o rolador.', 'error');
            } else if (dice.quantity > MAX_DICE) {
                notify(`O rolador aceita até ${MAX_DICE} dados por vez.`, 'error');
            } else {
                document.dispatchEvent(new CustomEvent('dice:roll', { detail: dice }));
            }
            return;
        }

        const spawn = event.target.closest('[data-monster-spawn]');
        if (!spawn) return;

        const card = spawn.closest('[data-monster]');
        const amount = Math.max(1, Math.min(30, Number.parseInt(card.querySelector('[data-monster-count]').value, 10) || 1));
        spawn.disabled = true;
        await spawnMonsters(config.bestiaryUrl, spawnTarget(bestiary), [{ id: card.dataset.monster, count: amount }], notify);
        spawn.disabled = false;
    });
}
