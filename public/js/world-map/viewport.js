// Navegação do mapa: arrastar para mover, roda do mouse (ou pinça) para
// aproximar em direção ao cursor, botões de zoom e centralizar.
// Coordenadas dos marcadores e desenhos são sempre % da imagem (0–100).

const MIN_SCALE = 0.5;
const MAX_SCALE = 6;
const DRAG_THRESHOLD = 4;

export function createViewport({ viewport, stage, image, onChange, onClick, canPan }) {
    const view = { scale: 1, x: 0, y: 0 };
    let drag = null;

    function apply() {
        stage.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
        stage.style.setProperty('--inverse-scale', String(1 / view.scale));
        onChange?.(view);
    }

    /** Ajusta a imagem inteira dentro da área visível. */
    function reset() {
        const box = viewport.getBoundingClientRect();
        const width = image.naturalWidth || box.width;
        const height = image.naturalHeight || box.height;
        const fit = Math.min(box.width / width, box.height / height);

        stage.style.width = `${width * fit}px`;
        stage.style.height = `${height * fit}px`;
        view.scale = 1;
        view.x = (box.width - width * fit) / 2;
        view.y = (box.height - height * fit) / 2;
        apply();
    }

    function zoomAt(factor, clientX, clientY) {
        const box = viewport.getBoundingClientRect();
        const pointX = clientX - box.left;
        const pointY = clientY - box.top;
        const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, view.scale * factor));
        const ratio = next / view.scale;

        view.x = pointX - (pointX - view.x) * ratio;
        view.y = pointY - (pointY - view.y) * ratio;
        view.scale = next;
        apply();
    }

    function zoomCenter(factor) {
        const box = viewport.getBoundingClientRect();
        zoomAt(factor, box.left + box.width / 2, box.top + box.height / 2);
    }

    /** Ponto da tela em % da imagem, ou null fora dela. */
    function toPercent(clientX, clientY) {
        const rect = image.getBoundingClientRect();
        const x = ((clientX - rect.left) / rect.width) * 100;
        const y = ((clientY - rect.top) / rect.height) * 100;

        if (x < 0 || x > 100 || y < 0 || y > 100) return null;

        return { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
    }

    /** Centraliza um ponto (em %) na tela, aproximando um pouco. */
    function focus(point, scale = Math.max(view.scale, 2)) {
        const box = viewport.getBoundingClientRect();
        const width = parseFloat(stage.style.width) || box.width;
        const height = parseFloat(stage.style.height) || box.height;

        view.scale = Math.min(MAX_SCALE, scale);
        view.x = box.width / 2 - (point.x / 100) * width * view.scale;
        view.y = box.height / 2 - (point.y / 100) * height * view.scale;
        apply();
    }

    viewport.addEventListener('wheel', (event) => {
        event.preventDefault();
        zoomAt(event.deltaY < 0 ? 1.15 : 1 / 1.15, event.clientX, event.clientY);
    }, { passive: false });

    viewport.addEventListener('pointerdown', (event) => {
        if (event.button !== 0 || event.target.closest('button, a, input, select, textarea, .glass') || !canPan()) return;

        drag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, x: view.x, y: view.y, moved: false };
    });

    viewport.addEventListener('pointermove', (event) => {
        if (!drag || drag.id !== event.pointerId) return;

        const dx = event.clientX - drag.startX;
        const dy = event.clientY - drag.startY;

        if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;

        if (!drag.moved) {
            drag.moved = true;
            viewport.setPointerCapture(event.pointerId);
            viewport.classList.add('is-dragging');
        }

        view.x = drag.x + dx;
        view.y = drag.y + dy;
        apply();
    });

    const endDrag = (event) => {
        if (!drag || drag.id !== event.pointerId) return;

        const wasClick = !drag.moved;
        drag = null;
        viewport.classList.remove('is-dragging');

        if (wasClick && event.type === 'pointerup') onClick?.(event);
    };

    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointercancel', endDrag);

    if (image.complete) reset();
    else image.addEventListener('load', reset, { once: true });

    window.addEventListener('resize', reset);

    return { view, reset, zoomCenter, toPercent, focus };
}
