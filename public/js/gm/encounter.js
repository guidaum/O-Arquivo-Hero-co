// Gerador de encontros: o servidor sorteia (Bestiary::encounter) e aqui o
// mestre ajusta as quantidades. O XP ajustado usa o mesmo multiplicador por
// quantidade de criaturas do servidor (Bestiary::countMultiplier).

import { getJson } from '../core/http.js';
import { el, icon, replace } from '../core/dom.js';
import { spawnMonsters } from './bestiary.js';

const DIFFICULTIES = [['mortal', 'Mortal'], ['dificil', 'Difícil'], ['medio', 'Médio'], ['facil', 'Fácil']];
const TACTICS = {
    balanced: 'Patrulha equilibrada',
    solo: 'Criatura solitária',
    boss_minions: 'Chefe e lacaios',
    swarm: 'Enxame',
};

export function countMultiplier(count) {
    if (count <= 1) return 1;
    if (count === 2) return 1.5;
    if (count <= 6) return 2;
    if (count <= 10) return 2.5;
    if (count <= 14) return 3;
    return 4;
}

const number = (value) => new Intl.NumberFormat('pt-BR').format(value);

export function setupEncounter(root, { config, notify, spawnTarget }) {
    const section = root.querySelector('[data-encounter]');
    if (!section) return;

    const budgets = JSON.parse(section.dataset.budgets);
    const form = section.querySelector('[data-encounter-form]');
    const result = section.querySelector('[data-encounter-result]');
    const groupsList = section.querySelector('[data-encounter-groups]');
    const $ = (name) => section.querySelector(`[data-encounter-${name}]`);
    let groups = [];

    function rating(adjusted) {
        const match = DIFFICULTIES.find(([key]) => adjusted >= budgets[key]);
        return match ? match : ['trivial', 'Trivial'];
    }

    function renderTotals() {
        const creatures = groups.reduce((sum, group) => sum + group.count, 0);
        const total = groups.reduce((sum, group) => sum + group.xp * group.count, 0);
        const adjusted = Math.round(total * countMultiplier(creatures));
        const [key, label] = rating(adjusted);

        $('total').textContent = `${number(total)} XP`;
        $('adjusted').textContent = `${number(adjusted)} XP`;
        $('rating').textContent = creatures ? `${label} · ${creatures} ${creatures === 1 ? 'criatura' : 'criaturas'}` : 'Sem criaturas';
        $('rating').dataset.rating = key;
        $('spawn').disabled = creatures === 0 || !spawnTarget(section);
    }

    function renderGroups() {
        replace(groupsList, ...groups.map((group, index) => el('li', { class: 'gm-encounter__group' },
            el('div', { class: 'gm-encounter__monster' },
                el('strong', {}, group.name),
                el('small', { class: 'muted' }, `${group.type} · ND ${group.cr} · ${number(group.xp)} XP · ${group.hp} PV`),
            ),
            el('div', { class: 'gm-encounter__stepper' },
                el('button', { type: 'button', class: 'icon-button icon-button--bordered', 'data-step': '-1', 'data-index': String(index), 'aria-label': `Menos ${group.name}` }, icon('chevron-down', 14)),
                el('span', { class: 'gm-encounter__count' }, `×${group.count}`),
                el('button', { type: 'button', class: 'icon-button icon-button--bordered', 'data-step': '1', 'data-index': String(index), 'aria-label': `Mais ${group.name}` }, icon('chevron-up', 14)),
                el('button', { type: 'button', class: 'icon-button icon-button--danger', 'data-remove': String(index), 'aria-label': `Remover ${group.name}` }, icon('trash', 14)),
            ),
        )));
        renderTotals();
    }

    async function generate() {
        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;

        try {
            const encounter = await getJson(config.encounterUrl, Object.fromEntries(new FormData(form)));
            groups = encounter.monsters.map((monster) => ({ ...monster }));
            $('name').textContent = encounter.name;
            $('tactic').textContent = TACTICS[encounter.tactic] ?? encounter.tactic;
            $('target').textContent = `${number(encounter.target_xp)} XP`;
            result.hidden = false;
            renderGroups();
        } catch (failure) {
            notify(failure.message, 'error');
        } finally {
            button.disabled = false;
        }
    }

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        generate();
    });
    $('reroll').addEventListener('click', generate);

    groupsList.addEventListener('click', (event) => {
        const step = event.target.closest('[data-step]');
        const remove = event.target.closest('[data-remove]');

        if (step) {
            const group = groups[Number(step.dataset.index)];
            group.count = Math.max(1, Math.min(30, group.count + Number(step.dataset.step)));
        } else if (remove) {
            groups.splice(Number(remove.dataset.remove), 1);
        } else {
            return;
        }

        renderGroups();
    });

    $('spawn').addEventListener('click', async () => {
        const button = $('spawn');
        button.disabled = true;
        const placed = await spawnMonsters(
            config.bestiaryUrl,
            spawnTarget(section),
            groups.map((group) => ({ id: group.id, count: group.count })),
            notify,
        );
        if (placed) {
            groups = [];
            result.hidden = true;
        }
        renderTotals();
    });
}
