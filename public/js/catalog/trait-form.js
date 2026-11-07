// Custo da vantagem/defeito calculado enquanto o mestre digita.
// Usa o espelho das regras do servidor (core/traits.js); o valor que vale
// é sempre o calculado no servidor.

import { traitCostDetails } from '../core/traits.js';

const form = document.querySelector('[data-trait-form]');

if (form) {
    const type = form.querySelector('[data-trait-type]');
    const modifier = form.querySelector('[data-trait-modifier]');
    const effect = form.querySelector('[data-trait-effect]');
    const total = form.querySelector('[data-trait-cost]');
    const detail = form.querySelector('[data-trait-cost-detail]');

    const update = () => {
        const cost = traitCostDetails({
            type: type.value,
            modifier: modifier.value,
            effect: effect.value,
        });
        const rounding = cost.isAdvantage ? 'para cima' : 'para baixo';

        total.textContent = `${cost.total} ${cost.total === 1 ? 'ponto' : 'pontos'}`;
        detail.textContent = `Modificador ${cost.modifier} + metade dos efeitos (${cost.positiveEffectSum} ÷ 2, ${rounding}) = ${cost.modifier} + ${cost.halfEffect}`;
    };

    [type, modifier, effect].forEach((field) => field.addEventListener('input', update));
    update();
}
