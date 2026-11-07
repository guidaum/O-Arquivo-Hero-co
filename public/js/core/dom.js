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

/** Troca o conteúdo de um elemento. */
export function replace(parent, ...children) {
    parent.replaceChildren();
    append(parent, children);
}
