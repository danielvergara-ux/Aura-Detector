'use client';

import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';
import { AURA_CONFIG } from '@/lib/aura/aura-config';
import type { AuraTier } from '@/types/aura';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  hueShift: number;
}

interface AuraParticlesProps {
  tier: AuraTier;
  /** Multiplies the tier's particle budget. */
  density?: number;
  /** 'ambient' drifts upward; 'burst' explodes from the centre once. */
  mode?: 'ambient' | 'burst';
  className?: string;
}

/**
 * Canvas particle field.
 *
 * A single canvas beats hundreds of DOM nodes on mobile by a wide margin, and
 * it lets the particle budget scale with the tier without touching layout.
 * Everything is drawn with additive blending so the field reads as energy
 * rather than confetti.
 */
export function AuraParticles({
  tier,
  density = 1,
  mode = 'ambient',
  className,
}: AuraParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const isSmall = window.innerWidth < 500;
    const scale = isSmall ? AURA_CONFIG.effects.mobileParticleScale : 1;
    const budget = Math.min(
      AURA_CONFIG.effects.maxParticles,
      Math.round(tier.particles * density * scale * (reduceMotion ? 0.3 : 1)),
    );

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const [r, g, b] = tier.rgb.split(' ').map(Number) as [number, number, number];

    const spawn = (initial: boolean): Particle => {
      if (mode === 'burst') {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * (4 + tier.intensity * 1.6);
        const maxLife = 60 + Math.random() * 70;
        return {
          x: width / 2,
          y: height / 2,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0,
          maxLife,
          size: 1 + Math.random() * 2.4,
          hueShift: Math.random(),
        };
      }
      const maxLife = 140 + Math.random() * 220;
      return {
        x: Math.random() * width,
        y: initial ? Math.random() * height : height + 10,
        vx: (Math.random() - 0.5) * 0.25,
        vy: -0.15 - Math.random() * (0.25 + tier.intensity * 0.12),
        life: initial ? Math.random() * maxLife : 0,
        maxLife,
        size: 0.7 + Math.random() * 1.9,
        hueShift: Math.random(),
      };
    };

    let particles: Particle[] = Array.from({ length: budget }, () => spawn(true));

    let raf = 0;
    let running = true;

    const draw = () => {
      if (!running) return;
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';

      for (let i = 0; i < particles.length; i += 1) {
        const p = particles[i] as Particle;
        p.x += p.vx;
        p.y += p.vy;
        p.life += 1;

        if (mode === 'burst') {
          // Drag + gravity so the burst settles instead of flying forever.
          p.vx *= 0.975;
          p.vy = p.vy * 0.975 + 0.02;
        }

        const t = p.life / p.maxLife;
        if (t >= 1 || p.y < -20) {
          if (mode === 'ambient') {
            particles[i] = spawn(false);
            continue;
          }
          continue;
        }

        const alpha = mode === 'burst' ? Math.max(0, 1 - t) : Math.sin(t * Math.PI) * 0.85;
        const size = p.size * (mode === 'burst' ? 1 + t * 0.6 : 1);

        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 4);
        const mix = p.hueShift * 40;
        gradient.addColorStop(0, `rgba(${r + mix}, ${g + mix}, ${b + mix}, ${alpha})`);
        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size * 4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = 'source-over';
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);

    // Stop burning battery when the tab is hidden.
    const onVisibility = () => {
      running = document.visibilityState === 'visible';
      if (running) raf = requestAnimationFrame(draw);
      else cancelAnimationFrame(raf);
    };
    document.addEventListener('visibilitychange', onVisibility);

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
      observer.disconnect();
      particles = [];
    };
  }, [tier, density, mode, reduceMotion]);

  return <canvas ref={canvasRef} className={className} aria-hidden />;
}
