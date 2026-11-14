// Barra lateral da masmorra: painel do token ou da área selecionada, lista de
// tokens, ordem de combate e a ficha do personagem em popup.

import { deleteJson, request } from '../core/http.js';
import { busy, el, icon, replace } from '../core/dom.js';

export function createPanel(ctx, annotations) {
    const { root, $, config, state, stage, viewport } = ctx;

    // Ficha do personagem em popup: a própria página da ficha, embutida (sem
    // menu nem polling, ver core/theme-init.js); as rolagens dela vão ao chat.

    const sheetDialog = document.getElementById('dungeon-sheet');
    const sheetFrame = sheetDialog?.querySelector('[data-sheet-frame]');

    function openSheet(token) {
        if (!sheetDialog || !token.sheet_url) return;

        sheetDialog.querySelector('.modal__title').textContent = `Ficha · ${token.name}`;
        sheetDialog.querySelector('[data-sheet-link]').href = token.sheet_url;
        if (sheetFrame.getAttribute('src') !== token.sheet_url) sheetFrame.setAttribute('src', token.sheet_url);
        sheetDialog.showModal();
    }

    // Ao fechar, a ficha sai da memória e o mapa busca o estado (PV pode ter mudado).
    sheetDialog?.addEventListener('close', () => {
        sheetFrame.setAttribute('src', 'about:blank');
        ctx.refresh();
    });

    // Duplo clique (ou toque duplo) no token abre a ficha.
    stage.addEventListener('dblclick', (event) => {
        const tokenEl = event.target.closest('.token');
        const token = tokenEl ? state.tokens.find((item) => item.id === Number(tokenEl.dataset.token)) : null;

        if (token?.sheet_url) {
            event.stopPropagation();
            openSheet(token);
        }
    });

    // Seleção

    function selectToken(token) {
        state.selectedId = token.id;
        state.selectedAoeId = null;
        ctx.renderAll();
    }

    function selectAoe(id) {
        state.selectedAoeId = id;
        state.selectedId = null;
        ctx.renderAll();
    }

    async function updateToken(token, data) {
        try {
            const body = await request(ctx.url(config.tokensUrl, token.id), { method: 'PUT', data });
            state.tokens = state.tokens.map((item) => (item.id === token.id ? body.token : item));
            ctx.renderAll();
            ctx.refresh();
        } catch (failure) {
            ctx.fail(failure);
        }
    }

    function renderAoe(panel, aoe) {
        panel.hidden = false;
        replace(panel,
            el('header', { class: 'dungeon-selected__head' },
                el('span', { class: 'dungeon-selected__swatch', style: `--token-color: ${aoe.color}` }, icon('flame', 16)),
                el('strong', {}, aoe.name || 'Área de efeito'),
                el('button', { type: 'button', class: 'icon-button', title: 'Fechar', onClick: () => selectAoe(null) }, icon('x', 16))),
            el('p', { class: 'muted' }, `${aoe.radius_feet} pés · giro ${aoe.rotation}°`),
            aoe.can_edit ? el('div', { class: 'dungeon-selected__row' },
                el('button', { type: 'button', class: 'button button--secondary', onClick: () => annotations.rotateAoe(aoe, -15) }, '↺ 15°'),
                el('button', { type: 'button', class: 'button button--secondary', onClick: () => annotations.rotateAoe(aoe, 15) }, '↻ 15°'),
                el('button', { type: 'button', class: 'button button--danger', onClick: () => annotations.deleteAoe(aoe) }, icon('trash', 14))) : null);
    }

    function renderToken(panel, token) {
        panel.hidden = false;
        const control = token.can_control;

        replace(panel,
            el('header', { class: 'dungeon-selected__head' },
                el('span', { class: 'dungeon-selected__swatch', style: `--token-color: ${token.color}` }, token.name.charAt(0)),
                el('strong', {}, token.name),
                el('button', { type: 'button', class: 'icon-button', title: 'Centralizar', onClick: () => viewport.focus(token) }, icon('locate', 16)),
                el('button', { type: 'button', class: 'icon-button', title: 'Fechar', onClick: () => { state.selectedId = null; ctx.renderAll(); } }, icon('x', 16))),
            token.sheet_url ? el('button', { type: 'button', class: 'button button--secondary dungeon-selected__sheet', onClick: () => openSheet(token) }, icon('scroll-text', 14), ' Ver ficha') : null,
            el('div', { class: 'dungeon-selected__hp' },
                el('span', {}, `PV ${token.hp} / ${token.max_hp}`),
                el('span', { class: 'token__hp token__hp--wide' }, el('span', { style: `width: ${token.max_hp ? (token.hp / token.max_hp) * 100 : 100}%` }))),
            control ? el('div', { class: 'dungeon-selected__row' },
                [-5, -1, 1, 5].map((delta) => el('button', {
                    type: 'button',
                    class: `button ${delta < 0 ? 'button--danger' : 'button--secondary'} dungeon-selected__delta`,
                    onClick: () => updateToken(token, { hp: Math.max(0, Math.min(token.max_hp, token.hp + delta)) }),
                }, delta > 0 ? `+${delta}` : String(delta)))) : null,
            el('p', { class: 'eyebrow' }, 'Condições'),
            el('div', { class: 'chips' }, Object.entries(config.conditions).map(([id, condition]) => {
                const active = token.conditions.includes(id);
                return el('button', {
                    type: 'button',
                    class: `chip dungeon-condition${active ? ' is-active' : ''}`,
                    style: `--condition-color: ${condition.color}`,
                    disabled: !control,
                    'aria-pressed': String(active),
                    onClick: () => updateToken(token, { conditions: active ? token.conditions.filter((item) => item !== id) : [...token.conditions, id] }),
                }, `${condition.symbol} ${condition.name}`);
            })),
            el('div', { class: 'dungeon-selected__row' },
                el('label', { class: 'dungeon-options__field' }, 'Iniciativa ', el('input', {
                    class: 'field__input',
                    type: 'number',
                    value: token.initiative,
                    disabled: !control,
                    onChange: (event) => updateToken(token, { initiative: Number(event.target.value) || 0 }),
                })),
                el('button', {
                    type: 'button',
                    class: 'button button--secondary',
                    title: 'Rolar 1d20 no rolador de dados',
                    onClick: () => document.dispatchEvent(new CustomEvent('dice:roll', { detail: { sides: 20, quantity: 1, modifier: 0 } })),
                }, icon('dice', 14), ' Rolar d20')),
            config.isGm ? el('div', { class: 'dungeon-selected__row' },
                el('label', { class: 'dungeon-options__field' }, 'PV máx. ', el('input', {
                    class: 'field__input', type: 'number', min: 1, value: token.max_hp,
                    onChange: (event) => updateToken(token, { max_hp: Math.max(1, Number(event.target.value) || 1), hp: Math.min(token.hp, Math.max(1, Number(event.target.value) || 1)) }),
                })),
                el('button', { type: 'button', class: 'button button--secondary', onClick: () => updateToken(token, { is_hidden: !token.is_hidden }) },
                    icon(token.is_hidden ? 'eye' : 'eye-off', 14), token.is_hidden ? ' Revelar' : ' Ocultar')) : null,
            token.moved_by ? el('p', { class: 'muted dungeon-selected__note' }, `Movido por último por ${token.moved_by}.`) : null,
            control ? el('button', {
                type: 'button',
                class: 'button button--danger',
                onClick: async () => {
                    if (!window.confirm(`Remover ${token.name} do mapa?`)) return;
                    try {
                        await deleteJson(ctx.url(config.tokensUrl, token.id));
                        state.selectedId = null;
                        ctx.refresh();
                    } catch (failure) {
                        ctx.fail(failure);
                    }
                },
            }, icon('trash', 14), ' Remover do mapa') : null);
    }

    function renderSelected() {
        const panel = $('[data-selected]');
        const aoe = state.aoes.find((item) => item.id === state.selectedAoeId);
        const token = ctx.selectedToken();

        if (aoe) renderAoe(panel, aoe);
        else if (token) renderToken(panel, token);
        else if (!panel.querySelector('[data-keep]')) panel.hidden = true;
    }

    // Lista de tokens e combate

    function turnOrder() {
        return state.tokens.filter((token) => !token.is_hidden).sort((a, b) => b.initiative - a.initiative || a.id - b.id);
    }

    function tokenRow(token, extra = null) {
        const percent = token.max_hp ? (token.hp / token.max_hp) * 100 : 100;

        return el('li', {}, el('button', {
            type: 'button',
            class: `pin-list__item${token.id === state.selectedId ? ' is-selected' : ''}${token.id === state.combat.active_token_id ? ' is-active-turn' : ''}`,
            style: `--pin-color: ${token.color}`,
            onClick: () => {
                selectToken(token);
                viewport.focus(token);
            },
        },
        el('span', { class: 'pin-list__icon' }, token.is_hidden ? icon('eye-off', 16) : icon(token.type === 'player' ? 'user' : 'skull', 16)),
        el('span', { class: 'pin-list__text' },
            el('strong', {}, token.name),
            el('small', {}, `PV ${token.hp}/${token.max_hp} · Ini ${token.initiative}`),
            el('span', { class: 'token__hp token__hp--wide' }, el('span', { style: `width: ${percent}%` }))),
        extra));
    }

    function render() {
        renderSelected();

        replace($('[data-token-list]'), state.tokens.length === 0
            ? el('li', { class: 'pin-list__empty' }, 'Nenhum token no mapa ainda.')
            : state.tokens.map((token) => tokenRow(token)));

        const order = turnOrder();
        $('[data-round]').textContent = state.combat.in_combat ? `Rodada ${state.combat.round}` : 'Fora de combate';
        replace($('[data-turns]'), order.length === 0
            ? el('li', { class: 'pin-list__empty' }, 'Sem combatentes.')
            : order.map((token, index) => tokenRow(token, el('span', { class: 'dungeon-turn-index' }, String(index + 1)))));
    }

    root.querySelectorAll('[data-tab]').forEach((tab) => tab.addEventListener('click', () => {
        root.querySelectorAll('[data-tab]').forEach((item) => (item === tab ? item.setAttribute('aria-current', 'page') : item.removeAttribute('aria-current')));
        root.querySelectorAll('[data-panel]').forEach((panel) => { panel.hidden = panel.dataset.panel !== tab.dataset.tab; });
    }));

    // "Próximo turno" clicado duas vezes pularia um combatente: um pedido por vez.
    root.querySelectorAll('[data-combat]').forEach((button) => button.addEventListener('click', () => busy(button, async () => {
        try {
            const body = await request(config.combatUrl, { method: 'PUT', data: { action: button.dataset.combat } });
            state.combat = body.combat;
            const active = state.tokens.find((token) => token.id === body.combat.active_token_id);
            if (active) viewport.focus(active);
            ctx.refresh();
        } catch (failure) {
            ctx.fail(failure);
        }
    })));

    return { render, selectToken, selectAoe };
}
