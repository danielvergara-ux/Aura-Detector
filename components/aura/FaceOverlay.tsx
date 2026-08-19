'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { CAMERA_HINTS } from '@/content/aura-copy';
import type { FaceState } from '@/hooks/useFaceDetection';
import { cn } from '@/lib/utils/cn';

/**
 * Everything drawn on top of the camera while we look for a face:
 * the target reticle, the framing hint and the lock ring.
 *
 * The box is mirrored to match the mirrored video.
 */

export function FaceTarget({ face, scanning }: { face: FaceState; scanning: boolean }) {
  const reduceMotion = useReducedMotion();
  const box = face.box;
  const active = face.framing === 'good' || scanning;

  // Fall back to a centred target when there is no detection yet, so the HUD
  // never looks empty.
  const rect = box
    ? {
        left: `${(1 - box.x - box.width) * 100}%`,
        top: `${box.y * 100}%`,
        width: `${box.width * 100}%`,
        height: `${box.height * 100}%`,
      }
    : { left: '27%', top: '20%', width: '46%', height: '48%' };

  return (
    <motion.div
      className="pointer-events-none absolute"
      animate={rect}
      transition={{ type: 'spring', stiffness: 120, damping: 20, mass: 0.6 }}
      aria-hidden
    >
      <div
        className={cn(
          'relative h-full w-full rounded-[38%] border transition-colors duration-300',
          active ? 'border-aura/80' : 'border-white/25',
        )}
        style={active ? { boxShadow: '0 0 40px -8px rgb(var(--aura-rgb) / 0.7) inset' } : undefined}
      >
        {/* Corner brackets */}
        {[
          'left-0 top-0 border-l-2 border-t-2 rounded-tl-md',
          'right-0 top-0 border-r-2 border-t-2 rounded-tr-md',
          'left-0 bottom-0 border-b-2 border-l-2 rounded-bl-md',
          'right-0 bottom-0 border-b-2 border-r-2 rounded-br-md',
        ].map((position) => (
          <span
            key={position}
            className={cn(
              'absolute h-5 w-5 transition-colors duration-300',
              active ? 'border-aura' : 'border-white/40',
              position,
            )}
          />
        ))}

        {/* Tracking dots — pure decoration, not landmarks. */}
        {active && !reduceMotion
          ? [
              { left: '30%', top: '35%' },
              { left: '70%', top: '35%' },
              { left: '50%', top: '55%' },
              { left: '38%', top: '72%' },
              { left: '62%', top: '72%' },
            ].map((point, index) => (
              <motion.span
                key={index}
                className="absolute h-1 w-1 rounded-full bg-aura shadow-aura"
                style={point}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: [0.3, 1, 0.3], scale: 1 }}
                transition={{ duration: 1.8, repeat: Infinity, delay: index * 0.12 }}
              />
            ))
          : null}

        {/* Lock ring fills while the face holds still. */}
        {!scanning && face.lockProgress > 0 ? (
          <svg className="absolute -inset-2" viewBox="0 0 100 100" preserveAspectRatio="none">
            <rect
              x="1"
              y="1"
              width="98"
              height="98"
              rx="34"
              fill="none"
              stroke="rgb(var(--aura-rgb))"
              strokeWidth="1.5"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - face.lockProgress}
              opacity={0.9}
            />
          </svg>
        ) : null}
      </div>
    </motion.div>
  );
}

export function FramingHint({ face, scanning }: { face: FaceState; scanning: boolean }) {
  const hint = scanning
    ? CAMERA_HINTS.starting
    : face.locked
      ? CAMERA_HINTS.locked
      : face.framing === 'good'
        ? CAMERA_HINTS.detected
        : face.framing === 'too_far'
          ? CAMERA_HINTS.tooFar
          : face.framing === 'off_center'
            ? CAMERA_HINTS.offCenter
            : CAMERA_HINTS.searching;

  const emphasised = face.framing === 'good' || scanning;

  return (
    <motion.p
      key={hint}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'font-display text-center text-sm font-bold uppercase tracking-[0.2em]',
        emphasised ? 'aura-text' : 'text-white/70',
      )}
      aria-live="polite"
    >
      {hint}
    </motion.p>
  );
}

/** Vertical sweep line that runs while the analysis is in progress. */
export function ScannerBeam({ active }: { active: boolean }) {
  const reduceMotion = useReducedMotion();
  if (!active || reduceMotion) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div
        className="absolute inset-x-0 h-24 animate-scan-sweep"
        style={{
          background:
            'linear-gradient(to bottom, transparent, rgb(var(--aura-rgb) / 0.35), transparent)',
          boxShadow: '0 0 30px rgb(var(--aura-rgb) / 0.6)',
        }}
      />
    </div>
  );
}

/** Concentric halo that pulses around the face while scanning. */
export function AuraRing({ intensity = 1 }: { intensity?: number }) {
  const reduceMotion = useReducedMotion();
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
      <div className="relative h-[68vmin] w-[68vmin] max-h-[440px] max-w-[440px]">
        <div className="absolute inset-0 rounded-full border border-aura/20" />
        <div className="absolute inset-[8%] rounded-full border border-dashed border-aura/25 animate-spin-slow" />
        <div className="absolute inset-[18%] rounded-full border border-aura/30 animate-spin-reverse" />
        {!reduceMotion ? (
          <div
            className="absolute inset-[18%] rounded-full border-2 border-aura/60 animate-pulse-ring"
            style={{ animationDuration: `${Math.max(1.1, 2.6 - intensity * 0.3)}s` }}
          />
        ) : null}
      </div>
    </div>
  );
}
