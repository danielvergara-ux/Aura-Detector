'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';

/**
 * Landing atmosphere: a slow field of energy motes, a perspective grid, HUD
 * tick marks and fluctuating numbers.
 *
 * Kept behind the content and pointer-events-none. Everything animated here is
 * transform/opacity only, and the whole canvas idles when the tab is hidden.
 */
export function AmbientBackground({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;

    const resize = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const count = reduceMotion ? 18 : window.innerWidth < 500 ? 42 : 70;
    const motes = Array.from({ length: count }, () => ({
      x: Math.random(),
      y: Math.random(),
      z: 0.3 + Math.random() * 0.7,
      speed: 0.00008 + Math.random() * 0.00022,
      phase: Math.random() * Math.PI * 2,
    }));

    let raf = 0;
    let running = true;

    const draw = (time: number) => {
      if (!running) return;
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';

      for (const mote of motes) {
        mote.y -= mote.speed * (reduceMotion ? 200 : 900);
        if (mote.y < -0.05) {
          mote.y = 1.05;
          mote.x = Math.random();
        }
        const x = mote.x * width + Math.sin(time * 0.0004 + mote.phase) * 12 * mote.z;
        const y = mote.y * height;
        const radius = 1.2 + mote.z * 2.4;
        const alpha = 0.12 + mote.z * 0.3;

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 5);
        gradient.addColorStop(0, `rgba(180, 160, 255, ${alpha})`);
        gradient.addColorStop(0.5, `rgba(120, 200, 255, ${alpha * 0.35})`);
        gradient.addColorStop(1, 'rgba(120, 200, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius * 5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = 'source-over';
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

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
    };
  }, [reduceMotion]);

  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)} aria-hidden>
      {/* Aura bloom behind everything */}
      <div
        className="absolute left-1/2 top-[38%] h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70 blur-[60px]"
        style={{
          background:
            'radial-gradient(circle, rgb(var(--aura-rgb) / 0.35) 0%, rgb(var(--aura-rgb-2) / 0.18) 45%, transparent 70%)',
        }}
      />
      <div className="grid-floor absolute inset-0 opacity-60" />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className="noise absolute inset-0 opacity-[0.05] mix-blend-soft-light" />
      <HudTicks />
      <div className="scanlines absolute inset-0" />
      {/* Bottom fade so the CTA always wins the contrast fight */}
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-bg via-bg/70 to-transparent" />
    </div>
  );
}

/** Fluctuating HUD readouts pinned to the screen edges. */
function HudTicks() {
  const [values, setValues] = useState<number[]>([417, 1092, 66, 8]);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    const id = setInterval(() => {
      setValues((current) => current.map((v) => Math.max(1, v + Math.round((Math.random() - 0.5) * 40))));
    }, 420);
    return () => clearInterval(id);
  }, [reduceMotion]);

  return (
    <div className="absolute inset-0 font-mono text-[9px] uppercase tracking-[0.3em] text-white/25">
      <span className="absolute left-4 top-[22%]">SYS::{values[0]}</span>
      <span className="absolute right-4 top-[30%]">FLUX {values[1]}</span>
      <span className="absolute left-4 bottom-[26%]">CH.{values[2]}</span>
      <span className="absolute right-4 bottom-[34%]">Δ {values[3]}</span>
      <div className="absolute left-0 top-1/2 h-px w-8 bg-white/15" />
      <div className="absolute right-0 top-1/2 h-px w-8 bg-white/15" />
    </div>
  );
}
