// Motor de desenho do esboço. Três camadas empilhadas:
// - "area": cores semânticas (terreno, piso, água...), lidas pelo cartógrafo;
// - "stamps": símbolos posicionados (cidades, portas...), guardados como pontos;
// - "preview": linha, retângulo ou polígono em andamento.
// Ferramentas: brush, line, rect, polygon, bucket, stamp, eraser.

const HISTORY_LIMIT = 30;
const CLOSE_DISTANCE = 18;

function floodFill(ctx, startX, startY, rgb, width, height, tolerance = 40) {
    const image = ctx.getImageData(0, 0, width, height);
    const data = image.data;
    const start = (startY * width + startX) * 4;
    const target = [data[start], data[start + 1], data[start + 2]];

    if (Math.abs(target[0] - rgb[0]) + Math.abs(target[1] - rgb[1]) + Math.abs(target[2] - rgb[2]) < 6) return false;

    const matches = (index) => Math.abs(data[index] - target[0]) + Math.abs(data[index + 1] - target[1]) + Math.abs(data[index + 2] - target[2]) <= tolerance;
    const seen = new Uint8Array(width * height);
    const stack = [startX + startY * width];

    while (stack.length) {
        const pixel = stack.pop();

        if (seen[pixel]) continue;
        seen[pixel] = 1;

        const index = pixel * 4;
        if (!matches(index)) continue;

        data[index] = rgb[0];
        data[index + 1] = rgb[1];
        data[index + 2] = rgb[2];
        data[index + 3] = 255;

        const x = pixel % width;
        if (x > 0) stack.push(pixel - 1);
        if (x < width - 1) stack.push(pixel + 1);
        if (pixel >= width) stack.push(pixel - width);
        if (pixel < width * (height - 1)) stack.push(pixel + width);
    }

    ctx.putImageData(image, 0, 0);

    return true;
}

export function createSketch({ area, stamps, preview, hexToRgb, current, onChange }) {
    const ctx = area.getContext('2d', { willReadFrequently: true });
    const stampCtx = stamps.getContext('2d');
    const previewCtx = preview.getContext('2d');

    const state = {
        width: area.width,
        height: area.height,
        background: '#000000',
        stamps: [],
        polygon: [],
        drag: null,
        history: [],
        index: -1,
    };

    // Camadas

    function sizeLayers(width, height) {
        [area, stamps, preview].forEach((layer) => {
            layer.width = width;
            layer.height = height;
        });
        state.width = width;
        state.height = height;
    }

    function drawStamps() {
        stampCtx.clearRect(0, 0, state.width, state.height);

        state.stamps.forEach((stamp) => {
            const radius = stamp.size * 0.9;
            stampCtx.beginPath();
            stampCtx.arc(stamp.x, stamp.y, radius, 0, Math.PI * 2);
            stampCtx.fillStyle = stamp.color;
            stampCtx.fill();
            stampCtx.lineWidth = 3;
            stampCtx.strokeStyle = '#ffffff';
            stampCtx.stroke();
            stampCtx.fillStyle = '#ffffff';
            stampCtx.font = `bold ${Math.round(radius)}px sans-serif`;
            stampCtx.textAlign = 'center';
            stampCtx.textBaseline = 'middle';
            stampCtx.fillText(stamp.name.charAt(0), stamp.x, stamp.y + 1);
        });
    }

    function snapshot() {
        state.history = state.history.slice(0, state.index + 1);
        state.history.push({ image: ctx.getImageData(0, 0, state.width, state.height), stamps: state.stamps.map((stamp) => ({ ...stamp })) });

        if (state.history.length > HISTORY_LIMIT) state.history.shift();
        state.index = state.history.length - 1;
        onChange?.();
    }

    function restore(entry) {
        ctx.putImageData(entry.image, 0, 0);
        state.stamps = entry.stamps.map((stamp) => ({ ...stamp }));
        drawStamps();
        onChange?.();
    }

    // Ferramentas

    function point(event) {
        const rect = area.getBoundingClientRect();

        return {
            x: Math.max(0, Math.min(state.width - 1, ((event.clientX - rect.left) / rect.width) * state.width)),
            y: Math.max(0, Math.min(state.height - 1, ((event.clientY - rect.top) / rect.height) * state.height)),
        };
    }

    function strokeStyle(color, width) {
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    }

    function paintColor() {
        return current().tool === 'eraser' ? state.background : current().element.color;
    }

    function brushWidth() {
        const { element, scale } = current();

        return Math.max(2, element.size * scale);
    }

    function drawPolygon(points, context, close) {
        context.beginPath();
        points.forEach((p, i) => (i ? context.lineTo(p.x, p.y) : context.moveTo(p.x, p.y)));
        if (close) context.closePath();
    }

    function renderPreview(cursor = null) {
        previewCtx.clearRect(0, 0, state.width, state.height);
        const { tool, element } = current();
        previewCtx.strokeStyle = element.color;
        previewCtx.fillStyle = `${element.color}66`;
        previewCtx.lineWidth = tool === 'line' ? brushWidth() : 3;
        previewCtx.setLineDash(tool === 'polygon' ? [8, 6] : []);
        previewCtx.lineCap = 'round';

        if (tool === 'polygon' && state.polygon.length) {
            drawPolygon(cursor ? [...state.polygon, cursor] : state.polygon, previewCtx, false);
            previewCtx.stroke();
            previewCtx.beginPath();
            previewCtx.arc(state.polygon[0].x, state.polygon[0].y, CLOSE_DISTANCE / 2, 0, Math.PI * 2);
            previewCtx.strokeStyle = '#ffffff';
            previewCtx.stroke();
        } else if (state.drag && tool === 'line') {
            previewCtx.beginPath();
            previewCtx.moveTo(state.drag.start.x, state.drag.start.y);
            previewCtx.lineTo(state.drag.end.x, state.drag.end.y);
            previewCtx.stroke();
        } else if (state.drag && tool === 'rect') {
            const { start, end } = state.drag;
            previewCtx.fillRect(start.x, start.y, end.x - start.x, end.y - start.y);
            previewCtx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
        }
    }

    function closePolygon() {
        if (state.polygon.length >= 3) {
            strokeStyle(paintColor(), 2);
            drawPolygon(state.polygon, ctx, true);
            ctx.fill();
            snapshot();
        }
        state.polygon = [];
        renderPreview();
    }

    function removeStampNear(p) {
        const index = state.stamps.findIndex((stamp) => Math.hypot(stamp.x - p.x, stamp.y - p.y) <= stamp.size * 1.2);

        if (index === -1) return false;
        state.stamps.splice(index, 1);
        drawStamps();

        return true;
    }

    preview.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        event.preventDefault();

        const p = point(event);
        const { tool, element } = current();

        if (tool !== 'eraser' && (tool === 'stamp' || element.kind === 'stamp')) {
            if (element.kind !== 'stamp') return;
            state.stamps.push({ id: element.id, name: element.name, color: element.color, size: element.size * current().scale + 6, x: p.x, y: p.y });
            drawStamps();
            snapshot();
            return;
        }

        if (tool === 'bucket') {
            if (floodFill(ctx, Math.floor(p.x), Math.floor(p.y), hexToRgb(paintColor()), state.width, state.height)) snapshot();
            return;
        }

        if (tool === 'polygon') {
            if (state.polygon.length >= 3 && Math.hypot(p.x - state.polygon[0].x, p.y - state.polygon[0].y) < CLOSE_DISTANCE) {
                closePolygon();
            } else {
                state.polygon.push(p);
                renderPreview(p);
            }
            return;
        }

        preview.setPointerCapture(event.pointerId);
        state.drag = { start: p, end: p, last: p, erasedStamp: false };

        if (tool === 'brush' || tool === 'eraser') {
            if (tool === 'eraser') state.drag.erasedStamp = removeStampNear(p);
            strokeStyle(paintColor(), brushWidth());
            ctx.beginPath();
            ctx.arc(p.x, p.y, brushWidth() / 2, 0, Math.PI * 2);
            ctx.fill();
        }
    });

    preview.addEventListener('pointermove', (event) => {
        const p = point(event);
        const { tool } = current();

        if (tool === 'polygon' && state.polygon.length) {
            renderPreview(p);
            return;
        }

        if (!state.drag) return;
        state.drag.end = p;

        if (tool === 'brush' || tool === 'eraser') {
            if (tool === 'eraser') state.drag.erasedStamp = removeStampNear(p) || state.drag.erasedStamp;
            strokeStyle(paintColor(), brushWidth());
            ctx.beginPath();
            ctx.moveTo(state.drag.last.x, state.drag.last.y);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
            state.drag.last = p;
        } else {
            renderPreview();
        }
    });

    const finishDrag = () => {
        if (!state.drag) return;

        const { tool } = current();
        const { start, end } = state.drag;

        if (tool === 'line') {
            strokeStyle(paintColor(), brushWidth());
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
        } else if (tool === 'rect') {
            strokeStyle(paintColor(), 1);
            ctx.fillRect(Math.min(start.x, end.x), Math.min(start.y, end.y), Math.abs(end.x - start.x), Math.abs(end.y - start.y));
        }

        state.drag = null;
        renderPreview();
        snapshot();
    };

    preview.addEventListener('pointerup', finishDrag);
    preview.addEventListener('pointercancel', finishDrag);
    preview.addEventListener('dblclick', () => {
        if (current().tool === 'polygon') closePolygon();
    });

    // API

    return {
        reset(width, height, background) {
            sizeLayers(width, height);
            state.background = background;
            state.stamps = [];
            state.polygon = [];
            ctx.fillStyle = background;
            ctx.fillRect(0, 0, width, height);
            drawStamps();
            renderPreview();
            state.history = [];
            state.index = -1;
            snapshot();
        },
        undo() {
            if (state.index > 0) restore(state.history[--state.index]);
        },
        redo() {
            if (state.index < state.history.length - 1) restore(state.history[++state.index]);
        },
        cancelPolygon() {
            state.polygon = [];
            renderPreview();
        },
        canUndo: () => state.index > 0,
        canRedo: () => state.index < state.history.length - 1,
        stamps: () => state.stamps.map((stamp) => ({ ...stamp })),
        size: () => ({ width: state.width, height: state.height }),
        areaData: () => ctx.getImageData(0, 0, state.width, state.height),
        /** Esboço com os símbolos, como imagem (comparação e envio). */
        composite() {
            const canvas = document.createElement('canvas');
            canvas.width = state.width;
            canvas.height = state.height;
            const out = canvas.getContext('2d');
            out.drawImage(area, 0, 0);
            out.drawImage(stamps, 0, 0);

            return canvas;
        },
    };
}
