// Inventário: depois de uma rolagem de dano pela janela de rolagem
// (tools/roll-dialog.js), atualiza a quantidade da munição gasta ou tira o
// cartão quando ela acaba, sem recarregar a página.

document.addEventListener('roll:result', (event) => {
    const ammo = event.detail?.ammo;

    if (!ammo) {
        return;
    }

    const card = document.querySelector(`[data-item-card="${CSS.escape(String(ammo.id))}"]`);

    if (!card) {
        return;
    }

    if (ammo.quantity <= 0) {
        card.remove();
        return;
    }

    const badge = card.querySelector('[data-item-quantity]');

    if (badge) {
        badge.textContent = `x${ammo.quantity}`;
    }
});
