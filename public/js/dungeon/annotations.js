// Áreas de efeito e marcadores da masmorra: criação, giro, remoção e o
// painel de um marcador. Qualquer participante cria; o autor ou o mestre altera.

import { deleteJson, postJson, request } from '../core/http.js';
import { busy, el, icon, replace } from '../core/dom.js';

export function createAnnotations(ctx) {
    const { $, config, state } = ctx;
    const aoePreset = $('[data-aoe-preset]');
    const markerDialog = document.getElementById('dungeon-marker');
    const markerForm = document.querySelector('[data-marker-form]');
    let markerPoint = null;

    aoePreset.addEventListener('change', () => { $('[data-aoe-feet]').value = aoePreset.value.split('|')[1]; });

    async function createAoe(point) {
        const [type, , color, name] = aoePreset.value.split('|');

        try {
            await postJson(config.aoesUrl, {
                type,
                name,
                color,
                x: point.x,
                y: point.y,
                radius_feet: Number($('[data-aoe-feet]').value) || 20,
                rotation: Number($('[data-aoe-rotation]').value) || 0,
            });
            ctx.refresh();
        } catch (failure) {
            ctx.fail(failure);
        }
    }

    async function rotateAoe(aoe, delta) {
        try {
            await request(ctx.url(config.aoesUrl, aoe.id), { method: 'PUT', data: { rotation: (aoe.rotation + delta + 360) % 360 } });
            ctx.refresh();
        } catch (failure) {
            ctx.fail(failure);
        }
    }

    async function deleteAoe(aoe) {
        try {
            await deleteJson(ctx.url(config.aoesUrl, aoe.id));
            state.selectedAoeId = null;
            ctx.refresh();
        } catch (failure) {
            ctx.fail(failure);
        }
    }

    $('[data-aoe-clear]')?.addEventListener('click', async () => {
        if (!window.confirm('Remover todas as áreas de efeito deste mapa?')) return;
        try {
            await deleteJson(config.aoesUrl);
            ctx.refresh();
        } catch (failure) {
            ctx.fail(failure);
        }
    });

    function openMarkerForm(point) {
        markerPoint = point;
        markerForm.reset();
        markerDialog.showModal();
    }

    markerForm.addEventListener('submit', (event) => {
        event.preventDefault();
        busy(markerForm, async () => {
            try {
                await postJson(config.markersUrl, {
                    label: markerForm.elements.label.value,
                    category: markerForm.elements.category.value,
                    description: markerForm.elements.description.value,
                    ...markerPoint,
                });
                markerDialog.close();
                ctx.refresh();
            } catch (failure) {
                markerForm.querySelector('[data-marker-error]').textContent = failure.message;
            }
        });
    });

    // Painel do marcador clicado; "data-keep" impede que o painel de token o feche.
    function openMarker(marker) {
        const category = config.markerCategories[marker.category];
        const panel = $('[data-selected]');
        panel.hidden = false;
        state.selectedId = null;

        replace(panel,
            el('header', { class: 'dungeon-selected__head', 'data-keep': '' },
                el('span', { class: 'dungeon-selected__swatch', style: `--token-color: ${category.color}` }, icon(category.icon, 16)),
                el('strong', {}, marker.label),
                el('button', { type: 'button', class: 'icon-button', title: 'Fechar', onClick: () => { panel.hidden = true; } }, icon('x', 16))),
            el('p', { class: 'muted' }, category.label),
            marker.description ? el('p', {}, marker.description) : null,
            marker.can_delete ? el('button', {
                type: 'button',
                class: 'button button--secondary',
                onClick: async () => {
                    try {
                        await deleteJson(ctx.url(config.markersUrl, marker.id));
                        panel.hidden = true;
                        ctx.refresh();
                    } catch (failure) {
                        ctx.fail(failure);
                    }
                },
            }, icon('trash', 14), ' Remover marcador') : null);
    }

    return { createAoe, rotateAoe, deleteAoe, openMarkerForm, openMarker };
}
