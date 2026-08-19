'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';

interface CameraViewProps {
  className?: string;
  /** Dims the feed while the reveal takes over. */
  dimmed?: boolean;
}

/**
 * The camera feed.
 *
 * Mirrored horizontally because a selfie view that does not mirror feels
 * broken. `playsInline` + `muted` is what keeps iOS from going fullscreen.
 * Nothing here captures, records or transmits the stream.
 */
export const CameraView = forwardRef<HTMLVideoElement, CameraViewProps>(function CameraView(
  { className, dimmed = false },
  ref,
) {
  return (
    <div className={cn('scanlines vignette relative overflow-hidden bg-black', className)}>
      <video
        ref={ref}
        playsInline
        muted
        autoPlay
        disablePictureInPicture
        className={cn(
          'h-full w-full scale-x-[-1] object-cover transition-opacity duration-500',
          dimmed ? 'opacity-25' : 'opacity-100',
        )}
        aria-label="Vista previa de tu cámara, procesada solo en tu dispositivo"
      />
      {/* Aura wash over the feed, tinted by the current tier. */}
      <div
        className="pointer-events-none absolute inset-0 mix-blend-color-dodge opacity-30"
        style={{
          background:
            'radial-gradient(ellipse at 50% 45%, rgb(var(--aura-rgb) / 0.25) 0%, transparent 65%)',
        }}
        aria-hidden
      />
    </div>
  );
});
