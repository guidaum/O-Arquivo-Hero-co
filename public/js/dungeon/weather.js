// Clima visual do battlemap (MapAtmosphereOverlay.tsx): partículas de chuva
// (com relâmpagos), névoa, brasas ou neve num canvas sobre o mapa, na tela
// (não acompanha o zoom). Respeita "reduzir movimento": desenha um quadro só.

const COUNT = { rain: 120, fog: 24, embers: 65, snow: 85 };

function particle(type, width, height) {
    const random = Math.random;
    const base = { x: random() * width, y: random() * height };

    switch (type) {
        case 'rain':
            return { ...base, vx: -2 - random() * 2, vy: 14 + random() * 8, size: 1.2 + random() * 1.5, alpha: 0.35 + random() * 0.45 };
        case 'fog':
            return { ...base, vx: 0.2 + random() * 0.4, vy: (random() - 0.5) * 0.1, size: 100 + random() * 160, alpha: 0.08 + random() * 0.12 };
        case 'embers':
            return {
                ...base,
                vx: (random() - 0.5) * 1.2,
                vy: -1.5 - random() * 2.5,
                size: 1.5 + random() * 3,
                alpha: 0.5 + random() * 0.5,
                color: random() > 0.4 ? '#f97316' : random() > 0.5 ? '#ef4444' : '#facc15',
            };
        default:
            return { ...base, vx: (random() - 0.5) * 0.8, vy: 1.2 + random() * 1.8, size: 1.5 + random() * 3.5, alpha: 0.4 + random() * 0.5 };
    }
}

export function createWeather(canvas) {
    const ctx = canvas.getContext('2d');
    const still = window.matchMedia('(prefers-reduced-motion: reduce)');
    let type = 'none';
    let particles = [];
    let frame = 0;
    let flash = 0;

    function resize() {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
    }

    function move(p) {
        p.x += p.vx;
        p.y += p.vy;
        const { width, height } = canvas;

        if (type === 'embers') {
            if (p.y < -20) {
                p.y = height + 10;
                p.x = Math.random() * width;
            }
            if (p.x < -20) p.x = width + 10;
            if (p.x > width + 20) p.x = -10;
        } else if (type === 'fog') {
            if (p.x - p.size > width) {
                p.x = -p.size;
                p.y = Math.random() * height;
            }
        } else {
            if (p.y > height + 20) {
                p.y = -20;
                p.x = Math.random() * (width + 100);
            }
            if (p.x < -40) p.x = width + 20;
        }
    }

    function draw(p) {
        ctx.save();
        if (type === 'rain') {
            ctx.strokeStyle = `rgba(186, 230, 253, ${p.alpha})`;
            ctx.lineWidth = p.size;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x + p.vx * 2, p.y + p.vy * 2);
            ctx.stroke();
        } else if (type === 'fog') {
            const gradient = ctx.createRadialGradient(p.x, p.y, p.size * 0.1, p.x, p.y, p.size);
            gradient.addColorStop(0, `rgba(241, 245, 249, ${p.alpha * 1.5})`);
            gradient.addColorStop(0.6, `rgba(203, 213, 225, ${p.alpha * 0.8})`);
            gradient.addColorStop(1, 'rgba(203, 213, 225, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        } else {
            const color = type === 'embers' ? p.color : '#ffffff';
            ctx.fillStyle = color;
            ctx.shadowColor = color;
            ctx.shadowBlur = type === 'embers' ? 6 : 4;
            ctx.globalAlpha = p.alpha;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (type === 'rain' && !still.matches) {
            if (Math.random() < 0.003 && flash <= 0) flash = 0.35;
            if (flash > 0) {
                ctx.fillStyle = `rgba(224, 242, 254, ${flash})`;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                flash -= 0.03;
            }
        }

        particles.forEach((p) => {
            if (!still.matches) move(p);
            draw(p);
        });

        if (!still.matches) frame = requestAnimationFrame(render);
    }

    window.addEventListener('resize', () => {
        if (type !== 'none') {
            resize();
            if (still.matches) render();
        }
    });

    return {
        set(next) {
            const value = COUNT[next] ? next : 'none';
            if (value === type) return;
            type = value;
            cancelAnimationFrame(frame);
            canvas.hidden = type === 'none';
            canvas.style.mixBlendMode = type === 'embers' ? 'screen' : 'normal';
            if (type === 'none') {
                particles = [];
                return;
            }
            resize();
            particles = Array.from({ length: COUNT[type] }, () => particle(type, canvas.width, canvas.height));
            render();
        },
    };
}
