// Painel do Mestre: avisos, campos do gerador de NPCs, destino das criaturas
// e os módulos de cada aba (vida, bestiário e encontros).

import { setupHealth, setupCharacterSpawn } from './health.js';
import { setupBestiary } from './bestiary.js';
import { setupEncounter } from './encounter.js';
import { setupSounds } from './sounds.js';
import { toast } from '../core/toast.js';

const root = document.querySelector('[data-gm-dashboard]');

if (root) {
    const config = JSON.parse(root.dataset.config);
    const notify = (text, tone = 'info') => toast(text, tone);

    // Destino das criaturas: masmorra escolhida e se entram ocultas.
    const spawnTarget = (scope) => {
        const target = scope.querySelector('[data-spawn-target]');
        const select = target?.querySelector('[data-spawn-map]');
        if (!select) return null;

        return {
            mapId: Number(select.value),
            hidden: target.querySelector('[data-spawn-hidden]')?.checked ?? true,
            url: select.selectedOptions[0]?.dataset.url ?? config.mapsUrl,
        };
    };

    document.querySelectorAll('[data-spawn-target]').forEach((target) => {
        const select = target.querySelector('[data-spawn-map]');
        const link = target.querySelector('[data-spawn-open]');
        if (!select || !link) return;
        const sync = () => { link.href = select.selectedOptions[0]?.dataset.url ?? config.mapsUrl; };
        select.addEventListener('change', sync);
        sync();
    });

    // Gerador de NPCs: campos de monstro só com a caixa marcada.
    const npcForm = document.querySelector('[data-npc-form]');
    if (npcForm) {
        const toggle = npcForm.querySelector('[data-npc-monster]');
        const fields = npcForm.querySelector('[data-npc-monster-fields]');
        const sync = () => {
            fields.hidden = !toggle.checked;
            fields.querySelectorAll('input, select').forEach((input) => { input.disabled = fields.hidden; });
        };
        toggle.addEventListener('change', sync);
        sync();
    }

    document.querySelectorAll('[data-uncheck-all]').forEach((button) => {
        button.addEventListener('click', () => {
            document.querySelectorAll(button.dataset.uncheckAll).forEach((checkbox) => { checkbox.checked = false; });
        });
    });

    const context = { config, notify, spawnTarget };
    setupHealth(root, context);
    setupCharacterSpawn(root, context);
    setupBestiary(root, context);
    setupEncounter(root, context);
    setupSounds(root);
}
