// Estado atual da ficha: botões − e + ajustam os campos dentro dos limites
// (min/max calculados pelo servidor) e "Recuperar tudo" enche PV, ATP,
// proteção e sanidade. Nada é salvo até o formulário ser enviado.

function clamp(input, value) {
    const min = input.min === '' ? -Infinity : Number(input.min);
    const max = input.max === '' ? Infinity : Number(input.max);

    return Math.min(max, Math.max(min, value));
}

document.querySelectorAll('[data-step][data-step-for]').forEach((button) => {
    button.addEventListener('click', () => {
        const input = document.getElementById(button.dataset.stepFor);

        if (input) {
            input.value = String(clamp(input, (Number(input.value) || 0) + Number(button.dataset.step)));
        }
    });
});

document.querySelectorAll('[data-fill-max]').forEach((button) => {
    button.addEventListener('click', () => {
        const form = button.closest('form');

        ['current_pv', 'current_atp', 'protection', 'sanity'].forEach((name) => {
            const input = form?.elements.namedItem(name);

            if (input instanceof HTMLInputElement && input.max !== '') {
                input.value = input.max;
            }
        });
    });
});
