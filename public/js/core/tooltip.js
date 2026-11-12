// Balão de descrição ("i") para listas de escolha.
//
// const button = infoTip('Descrição longa...', 'Descrição de Ágil');
//
// Um único balão flutuante (position: fixed) serve a página inteira, então
// listas com rolagem não o cortam. Abre ao clicar (toque no celular) e, em
// telas com mouse, também ao passar o mouse ou focar com o teclado. Fecha com
// Esc, clique fora, rolagem ou quando o botão sai da página. O texto entra
// sempre como texto, nunca como HTML.

import { el, icon } from './dom.js';

let bubble = null;
let owner = null;
let hideTimer = null;
const hoverable = window.matchMedia('(hover: hover) and (pointer: fine)');

function ensureBubble() {
    if (bubble) return bubble;

    bubble = el('div', { class: 'info-tip', role: 'tooltip', id: 'info-tip', hidden: true });
    bubble.addEventListener('pointerenter', () => clearTimeout(hideTimer));
    bubble.addEventListener('pointerleave', () => { if (hoverable.matches) scheduleHide(); });
    document.body.append(bubble);

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && owner) {
            const button = owner;
            hide();
            button.focus();
        }
    });
    document.addEventListener('pointerdown', (event) => {
        if (owner && !owner.contains(event.target) && !bubble.contains(event.target)) hide();
    }, true);
    window.addEventListener('scroll', () => hide(), true);
    window.addEventListener('resize', () => hide());

    return bubble;
}

function place(button) {
    const margin = 8;
    const rect = button.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - margin * 2);

    bubble.style.maxWidth = `${width}px`;
    bubble.style.left = '0px';
    bubble.style.top = '0px';

    const box = bubble.getBoundingClientRect();
    const left = Math.min(Math.max(margin, rect.right - box.width), window.innerWidth - box.width - margin);
    const below = rect.bottom + margin;
    const top = below + box.height > window.innerHeight - margin && rect.top - box.height - margin > margin
        ? rect.top - box.height - margin
        : below;

    bubble.style.left = `${left}px`;
    bubble.style.top = `${top}px`;
}

function show(button) {
    ensureBubble();
    clearTimeout(hideTimer);

    if (owner && owner !== button) owner.setAttribute('aria-expanded', 'false');

    owner = button;
    bubble.replaceChildren(
        button.dataset.tipTitle ? el('strong', { class: 'info-tip__title' }, button.dataset.tipTitle) : '',
        el('span', { class: 'info-tip__text' }, button.dataset.tipText),
    );
    bubble.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    button.setAttribute('aria-describedby', 'info-tip');
    place(button);
}

function hide() {
    clearTimeout(hideTimer);
    if (!bubble || !owner) return;

    owner.setAttribute('aria-expanded', 'false');
    owner.removeAttribute('aria-describedby');
    owner = null;
    bubble.hidden = true;
}

function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hide, 150);
}

/** Botão "i" que mostra a descrição. title aparece em negrito no topo do balão. */
export function infoTip(text, label, title = '') {
    const button = el('button', {
        type: 'button',
        class: 'info-tip-button',
        'aria-label': label,
        'aria-expanded': 'false',
        dataset: { tipText: text, tipTitle: title },
        onClick: (event) => {
            // Dentro de cartões clicáveis, abrir a descrição não marca a escolha.
            event.preventDefault();
            event.stopPropagation();
            // Com mouse o balão já abriu ao passar por cima: o clique só o mantém.
            if (owner === button && !hoverable.matches) hide(); else show(button);
        },
        onPointerenter: () => { if (hoverable.matches) show(button); },
        onPointerleave: () => { if (hoverable.matches && owner === button) scheduleHide(); },
        onFocus: () => { if (hoverable.matches && button.matches(':focus-visible')) show(button); },
        onBlur: () => { if (owner === button) scheduleHide(); },
    }, icon('info', 16));

    return button;
}

/** Fecha o balão (ex.: antes de redesenhar a lista). */
export function hideInfoTip() {
    hide();
}
