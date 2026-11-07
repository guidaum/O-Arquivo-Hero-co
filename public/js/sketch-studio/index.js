// Estúdio de Esboços: liga o motor de desenho (canvas.js), o cartógrafo do
// navegador (cartographer.js) e o refino por IA gratuita no servidor
// (AI Horde, acompanhado por core/realtime.js).

import { postJson } from '../core/http.js';
import { subscribe } from '../core/realtime.js';
import { el, icon, replace } from '../core/dom.js';
import { BRUSH_SCALES, DIMENSIONS, hexToRgb, palette } from './elements.js';
import { createSketch } from './canvas.js';
import { renderMap } from './cartographer.js';

const root = document.querySelector('[data-studio]');

if (root) {
    const config = JSON.parse(root.dataset.config);
    const $ = (selector) => root.querySelector(selector);
    const layer = (name) => root.querySelector(`[data-layer="${name}"]`);
    const resultView = $('[data-result-view]');
    const error = $('[data-error]');
    const hint = $('[data-hint]');

    const state = {
        type: 'world',
        tool: 'brush',
        element: null,
        scale: 1,
        dimension: DIMENSIONS[0],
        results: [],
        selected: null,
        feed: null,
        dirtySinceIllustration: true,
    };

    const sketch = createSketch({
        area: layer('area'),
        stamps: layer('stamps'),
        preview: layer('preview'),
        hexToRgb,
        current: () => ({ tool: state.tool, element: state.element, scale: state.scale }),
        onChange: () => {
            state.dirtySinceIllustration = true;
            $('[data-undo]').disabled = !sketch.canUndo();
            $('[data-redo]').disabled = !sketch.canRedo();
        },
    });

    // Paleta e opções

    function renderPalette() {
        const { elements } = palette(state.type);

        replace($('[data-palette]'), elements.map((element) => el('button', {
            type: 'button',
            class: `studio__element${state.element?.id === element.id ? ' is-active' : ''}`,
            style: `--element-color: ${element.color}`,
            title: element.hint,
            'aria-pressed': String(state.element?.id === element.id),
            onClick: () => selectElement(element),
        }, el('span', { class: 'studio__swatch' }, icon(element.icon, 14)), element.name)));
    }

    function selectElement(element) {
        state.element = element;

        // Símbolos são posicionados com um clique; linhas usam a ferramenta de linha ou pincel.
        if (element.kind === 'stamp') setTool('stamp');
        else if (state.tool === 'stamp') setTool(element.kind === 'line' ? 'line' : 'brush');

        hint.textContent = element.kind === 'stamp'
            ? `${element.name}: clique no esboço para posicionar. A borracha remove símbolos.`
            : `${element.name}: ${element.hint}.`;
        renderPalette();
    }

    function setTool(tool) {
        state.tool = tool;
        if (tool !== 'polygon') sketch.cancelPolygon();
        root.querySelectorAll('[data-tool]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.tool === tool)));
    }

    function fillThemes() {
        const themes = state.type === 'dungeon' ? config.dungeonThemes : config.worldThemes;
        replace($('[data-theme]'), Object.entries(themes).map(([key, label]) => el('option', { value: key }, label)));
    }

    function fillDimensions() {
        replace($('[data-dimension]'), DIMENSIONS.map((dimension) => el('option', { value: dimension.id, selected: dimension === state.dimension }, `${dimension.name} (${dimension.width} × ${dimension.height})`)));
    }

    function resetSketch() {
        sketch.reset(state.dimension.width, state.dimension.height, palette(state.type).background.color);
        layer('area').closest('[data-canvas-wrap]').style.aspectRatio = `${state.dimension.width} / ${state.dimension.height}`;
        showView('sketch');
    }

    function setType(type) {
        if (type === state.type) return;
        if (sketch.canUndo() && !window.confirm('Trocar o tipo recomeça o esboço. Continuar?')) return;

        state.type = type;
        root.querySelectorAll('[data-type]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.type === type)));
        root.querySelectorAll('[data-dungeon-only]').forEach((node) => { node.hidden = type !== 'dungeon'; });
        root.querySelectorAll('[data-world-only]').forEach((node) => { node.hidden = type === 'dungeon'; });

        if (type === 'dungeon' && $('[data-name]').value === 'Novo Mundo de Aventuras') $('[data-name]').value = 'Nova Masmorra';
        if (type === 'world' && $('[data-name]').value === 'Nova Masmorra') $('[data-name]').value = 'Novo Mundo de Aventuras';

        // Masmorras com proporção comum: grade sugerida.
        if (type === 'dungeon') {
            const ratio = state.dimension.width / state.dimension.height;
            $('[data-grid-cols]').value = ratio >= 1.5 ? 24 : (ratio < 0.85 ? 14 : 24);
            $('[data-grid-rows]').value = ratio >= 1.5 ? 14 : 24;
        }

        fillThemes();
        selectElement(palette(type).elements[0]);
        resetSketch();
    }

    replace($('[data-scales]'), BRUSH_SCALES.map(([label, scale]) => el('button', {
        type: 'button',
        class: 'icon-button icon-button--bordered studio__scale',
        title: `Espessura: ${label}`,
        'aria-pressed': String(scale === state.scale),
        dataset: { scale },
        onClick: (event) => {
            state.scale = scale;
            root.querySelectorAll('[data-scale]').forEach((button) => button.setAttribute('aria-pressed', String(Number(button.dataset.scale) === scale)));
            event.currentTarget.blur();
        },
    }, el('span', { style: `--dot: ${4 + scale * 6}px` }))));

    root.querySelectorAll('[data-tool]').forEach((button) => button.addEventListener('click', () => {
        setTool(button.dataset.tool);
        if (state.element?.kind === 'stamp' && button.dataset.tool !== 'eraser') selectElement(palette(state.type).elements[0]);
    }));
    root.querySelectorAll('[data-type]').forEach((button) => button.addEventListener('click', () => setType(button.dataset.type)));

    $('[data-undo]').addEventListener('click', () => sketch.undo());
    $('[data-redo]').addEventListener('click', () => sketch.redo());
    $('[data-clear]').addEventListener('click', () => {
        if (window.confirm('Apagar todo o esboço?')) resetSketch();
    });

    $('[data-dimension]').addEventListener('change', (event) => {
        const next = DIMENSIONS.find((dimension) => dimension.id === event.target.value);
        if (sketch.canUndo() && !window.confirm('Mudar o tamanho recomeça o esboço. Continuar?')) {
            event.target.value = state.dimension.id;
            return;
        }
        state.dimension = next;
        resetSketch();
    });

    document.addEventListener('keydown', (event) => {
        if (!(event.ctrlKey || event.metaKey) || event.target.closest('input, textarea, select')) return;
        if (event.key.toLowerCase() === 'z' && !event.shiftKey) {
            event.preventDefault();
            sketch.undo();
        } else if (event.key.toLowerCase() === 'y' || (event.key.toLowerCase() === 'z' && event.shiftKey)) {
            event.preventDefault();
            sketch.redo();
        }
    });

    // Visualização: esboço ou resultado

    function showView(view) {
        const showResult = view === 'result' && state.selected;
        resultView.hidden = !showResult;
        if (showResult) resultView.src = state.selected.url;
        root.querySelectorAll('[data-view]').forEach((button) => button.classList.toggle('is-active', button.dataset.view === (showResult ? 'result' : 'sketch')));
        $('[data-view="result"]').disabled = state.results.length === 0;
    }

    root.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => showView(button.dataset.view)));

    // Resultados

    function addResult(result) {
        state.results.unshift(result);
        state.results = state.results.slice(0, 12);
        selectResult(result);
    }

    function selectResult(result) {
        state.selected = result;
        $('[data-results-card]').hidden = false;
        replace($('[data-results]'), state.results.map((item) => el('button', {
            type: 'button',
            class: `studio__thumb${item === state.selected ? ' is-active' : ''}`,
            title: item.label,
            onClick: () => selectResult(item),
        }, el('img', { src: item.url, alt: item.label }), el('span', {}, item.label))));
        showView('result');
    }

    function usedElements() {
        const area = sketch.areaData();
        const { elements, background } = palette(state.type);
        const colors = [background, ...elements.filter((element) => element.kind !== 'stamp')].map((element) => hexToRgb(element.color));
        const counts = new Array(colors.length).fill(0);
        const step = 16;

        for (let i = 0; i < area.data.length; i += 4 * step) {
            let best = 0;
            let bestDistance = Infinity;
            colors.forEach((rgb, index) => {
                const distance = (area.data[i] - rgb[0]) ** 2 + (area.data[i + 1] - rgb[1]) ** 2 + (area.data[i + 2] - rgb[2]) ** 2;
                if (distance < bestDistance) {
                    bestDistance = distance;
                    best = index;
                }
            });
            counts[best]++;
        }

        const total = area.data.length / 4 / step;
        const areaIds = elements.filter((element) => element.kind !== 'stamp')
            .filter((element, index) => counts[index + 1] / total > 0.002)
            .map((element) => element.id);

        return [...new Set([...areaIds, ...sketch.stamps().map((stamp) => stamp.id)])];
    }

    function illustrate() {
        const { elements, background } = palette(state.type);
        const canvas = renderMap({
            area: sketch.areaData(),
            stamps: sketch.stamps(),
            type: state.type,
            theme: $('[data-theme]').value,
            name: $('[data-name]').value.trim(),
            colors: [background, ...elements.filter((element) => element.kind !== 'stamp')].map((element) => element.color),
            grid: { cols: Number($('[data-grid-cols]').value) || 24, rows: Number($('[data-grid-rows]').value) || 14, show: $('[data-grid-show]').checked },
        });

        state.dirtySinceIllustration = false;
        state.lastIllustration = canvas;

        return canvas;
    }

    $('[data-illustrate]').addEventListener('click', () => {
        const button = $('[data-illustrate]');
        button.disabled = true;
        hint.textContent = 'Ilustrando...';

        // Deixa o navegador mostrar o aviso antes do cálculo pesado.
        setTimeout(() => {
            const canvas = illustrate();
            addResult({ kind: 'illustrated', label: `Ilustrado · ${$('[data-theme]').selectedOptions[0].textContent}`, url: canvas.toDataURL('image/png'), canvas });
            hint.textContent = 'Mapa ilustrado. Ajuste o esboço e ilustre de novo quando quiser.';
            button.disabled = false;
        }, 30);
    });

    // Refino por IA

    const progress = $('[data-ai-progress]');
    const fidelity = $('[data-fidelity]');
    fidelity?.addEventListener('input', () => { $('[data-fidelity-output]').textContent = `${fidelity.value}%`; });

    function scaledDataUrl(canvas, longest = 1024) {
        const scale = Math.min(1, longest / Math.max(canvas.width, canvas.height));
        const out = document.createElement('canvas');
        out.width = Math.round(canvas.width * scale);
        out.height = Math.round(canvas.height * scale);
        out.getContext('2d').drawImage(canvas, 0, 0, out.width, out.height);

        return out.toDataURL('image/webp', 0.9);
    }

    function setProgress(text) {
        progress.hidden = !text;
        progress.textContent = text ?? '';
    }

    $('[data-ai-render]')?.addEventListener('click', async () => {
        const button = $('[data-ai-render]');
        error.textContent = '';
        const base = state.dirtySinceIllustration || !state.lastIllustration ? illustrate() : state.lastIllustration;

        button.disabled = true;
        setProgress('Enviando o mapa ilustrado para a IA...');

        try {
            const body = await postJson(config.renderUrl, {
                image: scaledDataUrl(base),
                type: state.type,
                theme: $('[data-theme]').value,
                elements: usedElements(),
                prompt: $('[data-prompt]').value,
                width: base.width,
                height: base.height,
                fidelity: Number(fidelity.value),
                follow_lines: $('[data-follow-lines]').checked,
                variations: Number($('[data-variations]').value),
            });

            setProgress(body.message);
            watch(body.id, button);
        } catch (failure) {
            setProgress(null);
            error.textContent = failure.message;
            $('[data-results-card]').hidden = false;
            button.disabled = false;
        }
    });

    function watch(id, button) {
        state.feed?.stop();
        const started = Date.now();

        state.feed = subscribe(config.statusUrl.replace('__ID__', id), {
            interval: 5000,
            onData(body) {
                if (!body.done) {
                    const parts = ['A IA está desenhando'];
                    if (body.queue_position) parts.push(`posição na fila: ${body.queue_position}`);
                    if (body.wait_time) parts.push(`~${Math.ceil(body.wait_time / 60)} min`);
                    parts.push(`${Math.round((Date.now() - started) / 1000)} s`);
                    setProgress(`${parts.join(' · ')}...`);
                    return;
                }

                state.feed.stop();
                button.disabled = false;

                if (body.failed) {
                    setProgress(null);
                    error.textContent = body.message;
                    $('[data-results-card]').hidden = false;
                    return;
                }

                setProgress(`Pronto: ${body.images.length} variação(ões) da IA.`);
                body.images.slice().reverse().forEach((url, index) => addResult({
                    kind: 'ai',
                    label: `IA · variação ${body.images.length - index}`,
                    url,
                    render: id,
                    variation: body.images.length - index - 1,
                }));
            },
            onError(failure) {
                state.feed.stop();
                button.disabled = false;
                setProgress(null);
                error.textContent = failure.message;
            },
        });
    }

    // Baixar e salvar

    $('[data-download]').addEventListener('click', () => {
        if (!state.selected) return;
        const link = el('a', { href: state.selected.url, download: `${$('[data-name]').value.trim() || 'mapa'}.${state.selected.kind === 'ai' ? 'webp' : 'png'}` });
        document.body.append(link);
        link.click();
        link.remove();
    });

    $('[data-save]').addEventListener('click', async () => {
        if (!state.selected) return;
        const button = $('[data-save]');
        error.textContent = '';
        button.disabled = true;

        const data = new FormData();
        data.append('type', state.type);
        data.append('name', $('[data-name]').value.trim());
        data.append('subtitle', $('[data-subtitle]').value.trim());
        data.append('theme', $('[data-theme]').selectedOptions[0].textContent);
        data.append('default_scale', $('[data-scale]').value.trim());
        if (state.type === 'dungeon') {
            data.append('grid_cols', $('[data-grid-cols]').value);
            data.append('grid_rows', $('[data-grid-rows]').value);
        }

        try {
            if (state.selected.kind === 'ai') {
                data.append('render', state.selected.render);
                data.append('variation', state.selected.variation);
            } else {
                const blob = await new Promise((resolve) => state.selected.canvas.toBlob(resolve, 'image/webp', 0.92));
                data.append('image', blob, 'mapa.webp');
            }

            const body = await postJson(config.saveUrl, data);
            window.location.href = body.redirect;
        } catch (failure) {
            error.textContent = failure.message;
            button.disabled = false;
        }
    });

    // Início

    fillThemes();
    fillDimensions();
    selectElement(palette(state.type).elements[0]);
    resetSketch();
}
