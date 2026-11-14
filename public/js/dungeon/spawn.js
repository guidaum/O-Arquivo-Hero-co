// Entrada no mapa: o jogador coloca o próprio personagem; o mestre traz
// personagens da campanha, criaturas prontas ou personalizadas e ativa mapas.

import { postJson, request } from '../core/http.js';
import { busy, el, replace } from '../core/dom.js';

export function createSpawn(ctx) {
    const { root, $, config, state } = ctx;
    const joinButton = $('[data-join]');

    function freeCharacter() {
        const placed = new Set(state.tokens.map((token) => token.character_id));

        return config.myCharacters.find((character) => !placed.has(character.id)) ?? null;
    }

    function updateJoinButton() {
        if (joinButton) joinButton.hidden = !freeCharacter();
    }

    joinButton?.addEventListener('click', () => busy(joinButton, async () => {
        const character = freeCharacter();
        if (!character) return;

        try {
            const body = await postJson(config.tokensUrl, { mode: 'character', character_id: character.id });
            state.selectedId = body.token.id;
            ctx.notify(body.message, 'success');
            ctx.refresh();
        } catch (failure) {
            ctx.fail(failure);
        }
    }));

    if (config.isGm) {
        const hidden = () => document.querySelector('[data-spawn-hidden]').checked;
        // trigger: o botão clicado (ou o formulário), travado até a resposta.
        const spawn = (data, trigger) => busy(trigger, async () => {
            try {
                const body = await postJson(config.tokensUrl, data);
                ctx.notify(body.message, 'success');
                document.getElementById('spawn-token').close();
                ctx.refresh();
            } catch (failure) {
                document.querySelector('[data-spawn-error]').textContent = failure.message;
            }
        });

        replace(document.querySelector('[data-spawn-characters]'), config.campaignCharacters.length
            ? config.campaignCharacters.map((character) => el('button', { type: 'button', class: 'chip', onClick: (event) => spawn({ mode: 'character', character_id: character.id }, event.currentTarget) },
                character.name, character.owner ? el('small', {}, ` · ${character.owner}`) : null))
            : el('p', { class: 'muted' }, 'Nenhum personagem na campanha.'));

        replace(document.querySelector('[data-spawn-presets]'), Object.entries(config.presets).map(([key, preset]) => el('button', {
            type: 'button',
            class: 'chip',
            style: `border-color: ${preset.color}`,
            onClick: (event) => spawn({ mode: 'preset', preset: key, is_hidden: hidden() }, event.currentTarget),
        }, `${preset.name} (${preset.hp} PV)`)));

        document.querySelector('[data-spawn-form]').addEventListener('submit', (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            spawn({
                mode: 'custom',
                name: form.elements.name.value,
                hp: Number(form.elements.hp.value) || 10,
                type: form.elements.type.value,
                size: Number(form.elements.size.value) || 1,
                color: form.elements.color.value,
                is_hidden: hidden(),
            }, form);
        });

        root.querySelectorAll('[data-map-active]').forEach((input) => input.addEventListener('change', async () => {
            try {
                const body = await request(input.dataset.mapActive, { method: 'PUT', data: { active: input.checked } });
                ctx.notify(body.message, 'success');
            } catch (failure) {
                input.checked = !input.checked;
                ctx.fail(failure);
            }
        }));
    }

    return { updateJoinButton };
}
