// Listas editáveis em formulários (linhas que podem ser adicionadas e removidas).
//
// <div data-repeater>
//   <div data-repeater-rows> ...linhas [data-repeater-row]... </div>
//   <template data-repeater-template> uma linha nova, com __INDEX__ nos nomes </template>
//   <button type="button" data-repeater-add>Adicionar</button>
// </div>
//
// Cada linha pode ter um botão [data-repeater-remove]. O marcador __INDEX__
// do modelo é trocado por um número único, para os nomes dos campos
// (ex.: attributes[__INDEX__][id]) não se repetirem.

function nextIndex(repeater) {
    const current = Number(repeater.dataset.repeaterIndex ?? repeater.querySelectorAll('[data-repeater-row]').length);
    repeater.dataset.repeaterIndex = String(current + 1);

    return current;
}

document.querySelectorAll('[data-repeater]').forEach((repeater) => {
    const rows = repeater.querySelector('[data-repeater-rows]');
    const template = repeater.querySelector('template[data-repeater-template]');

    // Índices novos começam depois de todas as linhas já existentes (inclusive as que voltaram com erro).
    repeater.dataset.repeaterIndex = String(1000 + rows.querySelectorAll('[data-repeater-row]').length);

    repeater.querySelector('[data-repeater-add]')?.addEventListener('click', () => {
        const index = nextIndex(repeater);
        const html = template.innerHTML.replaceAll('__INDEX__', String(index));

        rows.insertAdjacentHTML('beforeend', html);
        rows.lastElementChild?.querySelector('input, select, textarea')?.focus();
    });

    rows.addEventListener('click', (event) => {
        const remove = event.target.closest('[data-repeater-remove]');

        if (remove) {
            remove.closest('[data-repeater-row]')?.remove();
        }
    });
});
