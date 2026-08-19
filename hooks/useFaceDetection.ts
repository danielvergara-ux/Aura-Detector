'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AuraFaceDetector,
  evaluateFraming,
  type FaceBox,
  type FaceFraming,
} from '@/lib/vision/face-detection';
import { AURA_CLIENT_CONFIG } from '@/lib/aura/aura-config';
import { track } from '@/lib/analytics';

export interface FaceState {
  ready: boolean;
  framing: FaceFraming;
  box: FaceBox | null;
  /** True once a well-framed face has held still long enough. */
  locked: boolean;
  /** 0..1 progress toward the lock. */
  lockProgress: number;
  source: 'mediapipe' | 'heuristic' | 'pending';
}

/**
 * Drives the detection loop at ~12fps.
 *
 * Full frame rate buys nothing here — the HUD interpolates between
 * observations — and the lower cadence keeps mid-range phones cool.
 */
export function useFaceDetection(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  enabled: boolean,
): FaceState {
  const [state, setState] = useState<FaceState>({
    ready: false,
    framing: 'searching',
    box: null,
    locked: false,
    lockProgress: 0,
    source: 'pending',
  });

  const detectorRef = useRef<AuraFaceDetector | null>(null);
  const goodSinceRef = useRef<number | null>(null);
  const reportedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let raf = 0;
    let lastRun = 0;
    const INTERVAL = 1000 / 12;

    const detector = new AuraFaceDetector();
    detectorRef.current = detector;

    const loop = (time: number) => {
      if (cancelled) return;
      raf = requestAnimationFrame(loop);
      if (time - lastRun < INTERVAL) return;
      lastRun = time;

      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      const observation = detector.detect(video, time);
      const framing = evaluateFraming(observation);

      if (framing === 'good') {
        goodSinceRef.current ??= time;
        if (!reportedRef.current) {
          reportedRef.current = true;
          track('face_detected', { source: observation.source });
        }
      } else {
        goodSinceRef.current = null;
      }

      const heldFor = goodSinceRef.current === null ? 0 : time - goodSinceRef.current;
      const lockProgress = Math.min(1, heldFor / AURA_CLIENT_CONFIG.faceLockMs);

      setState({
        ready: true,
        framing,
        box: observation.box,
        locked: lockProgress >= 1,
        lockProgress,
        source: detector.source,
      });
    };

    void detector.init().then(() => {
      if (cancelled) return;
      setState((s) => ({ ...s, ready: true, source: detector.source }));
      raf = requestAnimationFrame(loop);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      detector.dispose();
      detectorRef.current = null;
      goodSinceRef.current = null;
      reportedRef.current = false;
    };
  }, [enabled, videoRef]);

  return state;
}
