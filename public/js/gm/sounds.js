// Aba "Sons" do painel do mestre: mostra o campo de endereço quando o
// efeito usa um endereço externo, testa cada efeito com o som escolhido
// (ou o sintetizado) e toca as prévias da biblioteca.

import { playEffect, stopSound } from '../core/sound.js';

export function setupSounds(root) {
    const section = root.querySelector('[data-sounds]');
    if (!section) return;

    section.querySelectorAll('[data-sound-slot]').forEach((slot) => {
        const choice = slot.querySelector('[data-sound-choice]');
        const url = slot.querySelector('[data-sound-url]');

        const sync = () => {
            url.hidden = choice.value !== 'url';
            if (!url.hidden && document.activeElement === choice) url.focus();
        };
        choice.addEventListener('change', sync);

        slot.querySelector('[data-sound-test]').addEventListener('click', () => {
            stopSound();
            const source = choice.value === 'url' ? url.value.trim() : choice.selectedOptions[0]?.dataset.url ?? null;
            playEffect(slot.dataset.soundSlot, source || null, 0.6);
        });
    });

    let preview = null;
    section.addEventListener('click', (event) => {
        const button = event.target.closest('[data-sound-preview]');
        if (!button) return;

        if (preview) {
            preview.pause();
            const same = preview.dataset.src === button.dataset.soundPreview;
            preview = null;
            if (same) return;
        }

        preview = new Audio(button.dataset.soundPreview);
        preview.dataset.src = button.dataset.soundPreview;
        preview.volume = 0.6;
        preview.play().catch(() => { preview = null; });
    });
}
