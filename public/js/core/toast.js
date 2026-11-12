// Aviso flutuante único das telas autenticadas ([data-toast] no layout app):
// um aviso por vez, no rodapé, acima da barra inferior do celular, lido por
// leitores de tela (role="status"). Avisos presos a um contexto (a faixa
// sobre os mapas, a mensagem do assistente de criação) continuam no lugar deles.
//
// toast('Criatura colocada no mapa!', 'success');
// tons: info (padrão), success, danger (dano, perigo) e error.

const DURATION = 4000;
let timer = null;

export function toast(text, tone = 'info', duration = DURATION) {
    const region = document.querySelector('[data-toast]');

    if (!region || !text) return;

    region.textContent = text;
    region.dataset.tone = tone;
    region.hidden = false;
    clearTimeout(timer);
    timer = setTimeout(() => { region.hidden = true; }, duration);
}
