// Criação de elementos sem innerHTML: textos entram sempre como texto,
// nunca como HTML, então dados vindos do servidor não viram código.
//
// el('button', { class: 'button', type: 'button', onClick: fn, dataset: { id: 3 } }, 'Texto', outroElemento)

export function el(tag, attributes = {}, ...children) {
    const element = document.createElement(tag);

    Object.entries(attributes ?? {}).forEach(([name, value]) => {
        if (value === null || value === undefined || value === false) {
            return;
        }

        if (name.startsWith('on') && typeof value === 'function') {
            element.addEventListener(name.slice(2).toLowerCase(), value);
        } else if (name === 'dataset') {
            Object.assign(element.dataset, value);
        } else if (name === 'class') {
            element.className = value;
        } else if (value === true) {
            element.setAttribute(name, '');
        } else {
            element.setAttribute(name, String(value));
        }
    });

    append(element, children);

    return element;
}

function append(parent, children) {
    children.flat(Infinity).forEach((child) => {
        if (child === null || child === undefined || child === false) {
            return;
        }

        parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
    });
}

/** Ícone do sprite public/images/icons.svg (mesmo desenho do componente x-icon). */
export function icon(name, size = 18) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    const use = document.createElementNS(ns, 'use');
    const sprite = document.querySelector('meta[name="icon-sprite"]')?.content ?? '/images/icons.svg';

    Object.entries({ width: size, height: size, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', class: 'icon' })
        .forEach(([name, value]) => svg.setAttribute(name, String(value)));
    use.setAttribute('href', `${sprite}#${name}`);
    svg.append(use);

    return svg;
}

// Trava um botão (ou o botão de envio de um formulário) enquanto a tarefa
// roda: mostra o giro de .is-busy, avisa leitores de tela (aria-busy) e
// ignora cliques repetidos, que criariam tokens ou marcadores em dobro.
//
// button.addEventListener('click', () => busy(button, () => postJson(url, data)));
export async function busy(target, task) {
    const button = target instanceof HTMLFormElement ? target.querySelector('[type="submit"]') : target;

    if (!button) return task();
    if (button.getAttribute('aria-busy') === 'true') return undefined;

    button.classList.add('is-busy');
    button.setAttribute('aria-busy', 'true');
    button.disabled = true;

    try {
        return await task();
    } finally {
        button.classList.remove('is-busy');
        button.removeAttribute('aria-busy');
        button.disabled = false;
    }
}

/** Troca o conteúdo de um elemento. */
export function replace(parent, ...children) {
    parent.replaceChildren();
    append(parent, children);
}

// Centraliza um item dentro de uma barra com rolagem horizontal (abas,
// passos), sem mover a página. Nada acontece se a barra não rolar.
export function scrollIntoBar(bar, item, behavior = 'auto') {
    if (!bar || !item || bar.scrollWidth <= bar.clientWidth) {
        return;
    }

    const offset = item.getBoundingClientRect().left - bar.getBoundingClientRect().left + bar.scrollLeft;

    bar.scrollTo({ left: offset - (bar.clientWidth - item.offsetWidth) / 2, behavior });
}
