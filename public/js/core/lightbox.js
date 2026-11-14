// Visualizador de imagens: clicar numa imagem do conteúdo abre a imagem
// ampliada, com zoom (roda do mouse, pinça, toque duplo, botões e teclas
// + / - / 0) e arraste para mover quando ampliada. Esc ou clique fora fecha.
//
// Quais imagens abrem:
// - qualquer <img> dentro do conteúdo (main) ou de um modal, com pelo menos
//   MIN_SIZE px na tela, fora de links, botões e rótulos (que já têm ação);
// - qualquer elemento com data-zoom="<url>" (ex.: botões da galeria do
//   diário, imagem do chat dentro de um link), mesmo sendo link ou botão;
// - data-no-zoom num elemento (ou ancestral) desliga; telas com câmera
//   própria (mapas, masmorra) ficam de fora pelo [data-viewport]/[data-stage].

import { el, icon } from './dom.js';

const MIN_SIZE = 48;
const MIN_SCALE = 1;
const MAX_SCALE = 8;
const STEP = 1.4;

const EXCLUDED = 'a, button, label, summary, [data-no-zoom], [data-viewport], [data-stage], .lightbox';

let dialog = null;
let image = null;
let stage = null;
let percent = null;
let original = null;

const view = { scale: 1, x: 0, y: 0 };
const pointers = new Map();
let gesture = null;
let lastTap = 0;

// Imagem que abre ao clicar (sem data-zoom).
function zoomableImage(target) {
    const img = target.closest?.('img');

    if (!img || !img.closest('main, dialog') || img.closest(EXCLUDED)) return null;
    if (!img.currentSrc && !img.src) return null;

    const box = img.getBoundingClientRect();

    return box.width >= MIN_SIZE && box.height >= MIN_SIZE ? img : null;
}

function build() {
    image = el('img', { class: 'lightbox__image', alt: '', draggable: 'false', referrerpolicy: 'no-referrer' });
    stage = el('div', { class: 'lightbox__stage' }, image);
    percent = el('span', { class: 'lightbox__percent', 'aria-live': 'polite' }, '100%');
    original = el('a', { class: 'icon-button', target: '_blank', rel: 'noopener noreferrer', title: 'Abrir a imagem original', 'aria-label': 'Abrir a imagem original' }, icon('image', 18));

    const button = (name, label, onClick) => el('button', { type: 'button', class: 'icon-button', title: label, 'aria-label': label, onClick }, icon(name, 18));

    dialog = el('dialog', { class: 'lightbox', 'aria-label': 'Imagem ampliada' },
        stage,
        el('div', { class: 'lightbox__toolbar glass' },
            button('zoom-out', 'Diminuir zoom', () => zoomBy(1 / STEP)),
            percent,
            button('zoom-in', 'Aumentar zoom', () => zoomBy(STEP)),
            button('rotate-ccw', 'Tamanho original da tela', () => reset()),
            original,
            button('x', 'Fechar', () => dialog.close())));

    document.body.append(dialog);

    stage.addEventListener('wheel', onWheel, { passive: false });
    stage.addEventListener('pointerdown', onPointerDown);
    stage.addEventListener('pointermove', onPointerMove);
    stage.addEventListener('pointerup', onPointerUp);
    stage.addEventListener('pointercancel', onPointerUp);
    stage.addEventListener('dblclick', (event) => toggleZoom(event.clientX, event.clientY));

    // Clique no fundo (fora da imagem) fecha, se não houve arraste. Pela posição,
    // não pelo alvo: com a captura do ponteiro o clique chega ao palco mesmo na imagem.
    stage.addEventListener('click', (event) => {
        const box = image.getBoundingClientRect();
        const onImage = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;

        if (!onImage && !gesture?.moved) dialog.close();
    });

    dialog.addEventListener('keydown', (event) => {
        if (event.key === '+' || event.key === '=') zoomBy(STEP);
        else if (event.key === '-') zoomBy(1 / STEP);
        else if (event.key === '0') reset();
        else return;
        event.preventDefault();
    });

    dialog.addEventListener('close', () => {
        image.removeAttribute('src');
        pointers.clear();
        gesture = null;
        document.documentElement.classList.remove('has-lightbox');
    });
}

export function openLightbox(src, alt = '') {
    if (!src) return;
    if (!dialog) build();

    image.src = src;
    image.alt = alt || 'Imagem ampliada';
    original.href = src;
    reset();
    document.documentElement.classList.add('has-lightbox');
    dialog.showModal();
}

// Zoom e posição

function apply() {
    image.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
    percent.textContent = `${Math.round(view.scale * 100)}%`;
    stage.classList.toggle('is-zoomed', view.scale > 1);
}

function reset() {
    Object.assign(view, { scale: 1, x: 0, y: 0 });
    apply();
}

// Mantém a imagem dentro da tela: sem sobra vazia ao arrastar uma imagem ampliada.
function clamp() {
    const maxX = Math.max(0, (image.offsetWidth * view.scale - stage.clientWidth) / 2);
    const maxY = Math.max(0, (image.offsetHeight * view.scale - stage.clientHeight) / 2);
    view.x = Math.min(maxX, Math.max(-maxX, view.x));
    view.y = Math.min(maxY, Math.max(-maxY, view.y));
}

// Zoom em torno de um ponto da tela (cursor, centro da pinça ou centro do palco).
function zoomTo(scale, clientX, clientY) {
    const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
    const box = stage.getBoundingClientRect();
    const px = (clientX ?? box.left + box.width / 2) - (box.left + box.width / 2);
    const py = (clientY ?? box.top + box.height / 2) - (box.top + box.height / 2);
    const ratio = next / view.scale;

    view.x = px - (px - view.x) * ratio;
    view.y = py - (py - view.y) * ratio;
    view.scale = next;

    if (next === MIN_SCALE) {
        view.x = 0;
        view.y = 0;
    }

    clamp();
    apply();
}

function zoomBy(factor, clientX, clientY) {
    zoomTo(view.scale * factor, clientX, clientY);
}

function toggleZoom(clientX, clientY) {
    zoomTo(view.scale > 1 ? 1 : 2.5, clientX, clientY);
}

function onWheel(event) {
    event.preventDefault();
    zoomBy(event.deltaY < 0 ? 1.15 : 1 / 1.15, event.clientX, event.clientY);
}

// Arraste com um dedo/mouse; pinça com dois dedos; toque duplo alterna o zoom.

function pinchState() {
    const [a, b] = [...pointers.values()];

    return {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
    };
}

function onPointerDown(event) {
    if (event.button !== 0) return;

    stage.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size === 2) {
        gesture = { type: 'pinch', start: pinchState(), scale: view.scale, moved: true };
        return;
    }

    gesture = { type: 'pan', startX: event.clientX, startY: event.clientY, x: view.x, y: view.y, moved: false };

    if (event.pointerType === 'touch') {
        const now = Date.now();
        if (now - lastTap < 300) {
            toggleZoom(event.clientX, event.clientY);
            gesture.moved = true;
        }
        lastTap = now;
    }
}

function onPointerMove(event) {
    if (!pointers.has(event.pointerId) || !gesture) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (gesture.type === 'pinch' && pointers.size === 2) {
        const now = pinchState();
        zoomTo(gesture.scale * (now.distance / gesture.start.distance), now.x, now.y);
        return;
    }

    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;

    if (!gesture.moved && Math.hypot(dx, dy) < 4) return;
    gesture.moved = true;

    if (view.scale > 1) {
        view.x = gesture.x + dx;
        view.y = gesture.y + dy;
        clamp();
        apply();
    }
}

function onPointerUp(event) {
    pointers.delete(event.pointerId);

    // Ao soltar um dos dois dedos, o outro continua arrastando dali.
    if (gesture?.type === 'pinch' && pointers.size === 1) {
        const [rest] = [...pointers.values()];
        gesture = { type: 'pan', startX: rest.x, startY: rest.y, x: view.x, y: view.y, moved: true };
    }
}

// Abertura: delegação no documento (vale para conteúdo criado depois, como o chat).

document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey) return;

    const trigger = event.target.closest?.('[data-zoom]');

    if (trigger && !trigger.closest('[data-no-zoom]')) {
        event.preventDefault();
        openLightbox(trigger.dataset.zoom || trigger.querySelector('img')?.currentSrc, trigger.querySelector('img')?.alt);
        return;
    }

    const img = zoomableImage(event.target);

    if (img) {
        event.preventDefault();
        openLightbox(img.currentSrc || img.src, img.alt);
    }
});

// Cursor de lupa nas imagens que abrem (marcadas ao passar o mouse).
document.addEventListener('pointerover', (event) => {
    if (event.pointerType !== 'mouse' || event.target.tagName !== 'IMG') return;
    event.target.classList.toggle('is-zoomable', zoomableImage(event.target) !== null);
});
