import React from 'react';

export type WeatherType = 'none' | 'rain' | 'fog' | 'embers' | 'snow';

interface MapAtmosphereOverlayProps {
  weather: WeatherType;
  opacity?: number;
}

export const WEATHER_OPTIONS: Array<{ id: WeatherType; label: string; icon: string; desc: string }> = [
  { id: 'none', label: 'Límpido (Sem Clima)', icon: '☀️', desc: 'Visão limpa sem partículas' },
  { id: 'rain', label: 'Chuva & Tempestade', icon: '🌧️', desc: 'Gotas de chuva contínuas e relâmpagos sutis' },
  { id: 'fog', label: 'Névoa Volumétrica', icon: '🌫️', desc: 'Camadas de névoa espessa flutuante' },
  { id: 'embers', label: 'Brasas & Fagulhas', icon: '🔥', desc: 'Cinzas incandescentes de fogo ou magma' },
  { id: 'snow', label: 'Neve & Nevasca', icon: '❄️', desc: 'Flocos de neve flutuando suavemente' }
];

export default function MapAtmosphereOverlay({ weather, opacity = 1 }: MapAtmosphereOverlayProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const animFrameRef = React.useRef<number>(0);
  const flashAlphaRef = React.useRef<number>(0);

  React.useEffect(() => {
    if (weather === 'none') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize canvas to parent
    const updateSize = () => {
      if (canvas.parentElement) {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
      }
    };
    updateSize();

    // Particle state setup
    interface Particle {
      x: number;
      y: number;
      speedX: number;
      speedY: number;
      size: number;
      alpha: number;
      color?: string;
      rotation?: number;
      rotationSpeed?: number;
    }

    const particles: Particle[] = [];
    const count = weather === 'rain' ? 120 : weather === 'fog' ? 24 : weather === 'embers' ? 65 : 85;

    for (let i = 0; i < count; i++) {
      if (weather === 'rain') {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          speedX: -2 - Math.random() * 2,
          speedY: 14 + Math.random() * 8,
          size: 1.2 + Math.random() * 1.5,
          alpha: 0.35 + Math.random() * 0.45
        });
      } else if (weather === 'fog') {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          speedX: 0.2 + Math.random() * 0.4,
          speedY: (Math.random() - 0.5) * 0.1,
          size: 100 + Math.random() * 160,
          alpha: 0.08 + Math.random() * 0.12
        });
      } else if (weather === 'embers') {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          speedX: (Math.random() - 0.5) * 1.2,
          speedY: -1.5 - Math.random() * 2.5,
          size: 1.5 + Math.random() * 3,
          alpha: 0.5 + Math.random() * 0.5,
          color: Math.random() > 0.4 ? '#f97316' : Math.random() > 0.5 ? '#ef4444' : '#facc15'
        });
      } else if (weather === 'snow') {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          speedX: (Math.random() - 0.5) * 0.8,
          speedY: 1.2 + Math.random() * 1.8,
          size: 1.5 + Math.random() * 3.5,
          alpha: 0.4 + Math.random() * 0.5
        });
      }
    }

    // Animation loop
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Rain Lightning flash
      if (weather === 'rain') {
        if (Math.random() < 0.003 && flashAlphaRef.current <= 0) {
          flashAlphaRef.current = 0.35;
        }
        if (flashAlphaRef.current > 0) {
          ctx.fillStyle = `rgba(224, 242, 254, ${flashAlphaRef.current})`;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          flashAlphaRef.current -= 0.03;
        }
      }

      particles.forEach(p => {
        p.x += p.speedX;
        p.y += p.speedY;

        // Wrap around boundaries
        if (weather === 'embers') {
          if (p.y < -20) {
            p.y = canvas.height + 10;
            p.x = Math.random() * canvas.width;
          }
          if (p.x < -20) p.x = canvas.width + 10;
          if (p.x > canvas.width + 20) p.x = -10;
        } else if (weather === 'fog') {
          if (p.x - p.size > canvas.width) {
            p.x = -p.size;
            p.y = Math.random() * canvas.height;
          }
        } else {
          // Rain and Snow
          if (p.y > canvas.height + 20) {
            p.y = -20;
            p.x = Math.random() * (canvas.width + 100);
          }
          if (p.x < -40) p.x = canvas.width + 20;
        }

        // Draw particle
        ctx.save();
        if (weather === 'rain') {
          ctx.strokeStyle = `rgba(186, 230, 253, ${p.alpha * opacity})`;
          ctx.lineWidth = p.size;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.speedX * 2, p.y + p.speedY * 2);
          ctx.stroke();
        } else if (weather === 'fog') {
          const grad = ctx.createRadialGradient(p.x, p.y, p.size * 0.1, p.x, p.y, p.size);
          grad.addColorStop(0, `rgba(241, 245, 249, ${p.alpha * opacity * 1.5})`);
          grad.addColorStop(0.6, `rgba(203, 213, 225, ${p.alpha * opacity * 0.8})`);
          grad.addColorStop(1, 'rgba(203, 213, 225, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (weather === 'embers') {
          ctx.fillStyle = p.color || '#f97316';
          ctx.shadowColor = p.color || '#f97316';
          ctx.shadowBlur = 6;
          ctx.globalAlpha = p.alpha * opacity;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (weather === 'snow') {
          ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha * opacity})`;
          ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
          ctx.shadowBlur = 4;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    window.addEventListener('resize', updateSize);
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', updateSize);
    };
  }, [weather, opacity]);

  if (weather === 'none') return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-25 select-none"
      style={{ mixBlendMode: weather === 'embers' ? 'screen' : 'normal' }}
    />
  );
}
