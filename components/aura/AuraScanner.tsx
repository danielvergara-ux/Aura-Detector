'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CameraView } from '@/components/camera/CameraView';
import { AuraRing, FaceTarget, FramingHint, ScannerBeam } from '@/components/aura/FaceOverlay';
import { AuraReveal } from '@/components/aura/AuraReveal';
import { ScanProgress } from '@/components/aura/ScanProgress';
import { DisclaimerBadge, ErrorState, LoadingLabel, PrivacyNote, SoundToggle } from '@/components/ui/primitives';
import { useSound } from '@/components/providers/SoundProvider';
import { useCamera } from '@/hooks/useCamera';
import { useFaceDetection } from '@/hooks/useFaceDetection';
import { useScanSequence } from '@/hooks/useScanSequence';
import { AURA_CLIENT_CONFIG } from '@/lib/aura/aura-config';
import { ERROR_COPY, LOADING_LABELS } from '@/content/aura-copy';
import { track } from '@/lib/analytics';
import type { AuraScan } from '@/types/aura';

type Stage = 'booting' | 'permission' | 'detecting' | 'scanning' | 'result' | 'error';

type FailureKind = 'camera' | 'denied' | 'server' | 'rate_limited';

/**
 * The whole scan experience, as one state machine.
 *
 * Timing note: the network request for the score is fired the moment the
 * animation starts, not when it ends. By the time the bar unsticks from 99%
 * the result is already in hand, so the reveal never waits on the network —
 * and the animation never gets cut short by a fast response either.
 */
export function AuraScanner({ challengeId }: { challengeId?: string }) {
  const { videoRef, status, start, stop } = useCamera();
  const { play, startScanner, unlock } = useSound();

  const [stage, setStage] = useState<Stage>('booting');
  const [failure, setFailure] = useState<FailureKind | null>(null);
  const [scan, setScan] = useState<AuraScan | null>(null);

  const scanPromise = useRef<Promise<AuraScan | null> | null>(null);
  const scannerAudio = useRef<{ setProgress: (p: number) => void; stop: () => void } | null>(null);
  const lockedRef = useRef(false);

  const detecting = stage === 'detecting';
  const scanning = stage === 'scanning';
  const face = useFaceDetection(videoRef, detecting || scanning);

  /* ---------------------------------------------------------------- */
  /* Camera lifecycle                                                  */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    void start();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status === 'ready') {
      setStage((current) => (current === 'booting' || current === 'permission' ? 'detecting' : current));
    } else if (status === 'denied') {
      setFailure('denied');
      setStage('error');
    } else if (status === 'unavailable') {
      setFailure('camera');
      setStage('error');
    } else if (status === 'requesting') {
      setStage('permission');
    }
  }, [status]);

  /* ---------------------------------------------------------------- */
  /* Scan start                                                        */
  /* ---------------------------------------------------------------- */

  const requestScore = useCallback(async (): Promise<AuraScan | null> => {
    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(challengeId ? { challengeId } : {}),
      });
      if (response.status === 429) {
        setFailure('rate_limited');
        return null;
      }
      if (!response.ok) {
        setFailure('server');
        return null;
      }
      const data = (await response.json()) as { scan: AuraScan };
      return data.scan;
    } catch {
      setFailure('server');
      return null;
    }
  }, [challengeId]);

  const beginScan = useCallback(() => {
    if (scanning || stage === 'result') return;
    void unlock();
    play('lock');
    setStage('scanning');
    scannerAudio.current = startScanner();
    // Kick off the request now; the animation runs in parallel.
    scanPromise.current = requestScore();
  }, [scanning, stage, unlock, play, startScanner, requestScore]);

  // Auto-start once a face has been held in frame long enough.
  useEffect(() => {
    if (!detecting || !face.locked || lockedRef.current) return;
    lockedRef.current = true;
    const timer = setTimeout(beginScan, 420);
    return () => clearTimeout(timer);
  }, [detecting, face.locked, beginScan]);

  // Never trap someone whose camera cannot find them.
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (!detecting) return;
    const timer = setTimeout(() => setTimedOut(true), AURA_CLIENT_CONFIG.faceTimeoutMs);
    return () => clearTimeout(timer);
  }, [detecting]);

  /* ---------------------------------------------------------------- */
  /* Sequence                                                          */
  /* ---------------------------------------------------------------- */

  const onSequenceComplete = useCallback(async () => {
    scannerAudio.current?.stop();
    scannerAudio.current = null;
    const result = await (scanPromise.current ?? Promise.resolve(null));
    if (result) {
      setScan(result);
      setStage('result');
      // The camera has done its job; release it before the reveal.
      stop();
    } else {
      setStage('error');
    }
  }, [stop]);

  const sequence = useScanSequence(scanning, onSequenceComplete);

  useEffect(() => {
    if (!scanning) return;
    scannerAudio.current?.setProgress(sequence.progress);
  }, [scanning, sequence.progress]);

  useEffect(() => () => scannerAudio.current?.stop(), []);

  /* ---------------------------------------------------------------- */
  /* Reset                                                             */
  /* ---------------------------------------------------------------- */

  const reset = useCallback(async () => {
    setScan(null);
    setFailure(null);
    setTimedOut(false);
    lockedRef.current = false;
    scanPromise.current = null;
    setStage('booting');
    await start();
  }, [start]);

  /* ---------------------------------------------------------------- */
  /* Render                                                            */
  /* ---------------------------------------------------------------- */

  if (stage === 'result' && scan) {
    return (
      <AuraReveal
        // Keyed by scan id so a paid reroll replays the whole reveal instead of
        // swapping the number in place.
        key={scan.id}
        scan={scan}
        animate
        onRescan={() => void reset()}
        onRerolled={(next) => setScan(next)}
        rescanLabel="Escanear otra vez"
      />
    );
  }

  if (stage === 'error') {
    const copy =
      failure === 'denied'
        ? ERROR_COPY.cameraDenied
        : failure === 'camera'
          ? ERROR_COPY.cameraUnavailable
          : failure === 'rate_limited'
            ? ERROR_COPY.rateLimited
            : ERROR_COPY.server;

    return (
      <main className="relative flex min-h-screen-dvh items-center justify-center px-6">
        <ErrorState
          title={copy.title}
          body={copy.body}
          action={copy.action}
          onAction={() => void reset()}
          secondary={
            failure === 'denied' ? (
              <p className="hud-label max-w-xs normal-case tracking-normal text-center">
                En iOS: Ajustes → Safari → Cámara → Permitir. En Android: toca el candado en la barra
                de direcciones → Permisos → Cámara.
              </p>
            ) : null
          }
        />
      </main>
    );
  }

  return (
    <main className="relative h-screen-dvh overflow-hidden bg-black">
      <CameraView ref={videoRef} className="absolute inset-0 h-full w-full" dimmed={false} />

      {/* HUD layer */}
      <div className="pointer-events-none absolute inset-0">
        <AuraRing intensity={scanning ? 4 : 1} />
        <FaceTarget face={face} scanning={scanning} />
        <ScannerBeam active={scanning} />
      </div>

      <div className="relative z-10 flex h-full flex-col justify-between px-5 py-4 safe-top safe-bottom">
        <header className="flex items-start justify-between">
          <div>
            <span className="font-display text-[10px] font-bold uppercase tracking-[0.3em] text-white/60">
              AURA<span className="text-aura">/</span>SCANNER
            </span>
            <p className="hud-label mt-1">
              {face.source === 'heuristic' ? 'modo ligero' : 'detector local'} ·{' '}
              {scanning ? 'analizando' : 'en espera'}
            </p>
          </div>
          <SoundToggle className="pointer-events-auto" />
        </header>

        <div className="flex flex-col items-center gap-4">
          <AnimatePresence mode="wait">
            {stage === 'booting' || stage === 'permission' ? (
              <motion.div
                key="boot"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-3 text-center"
              >
                <LoadingLabel labels={LOADING_LABELS} />
                <p className="max-w-xs text-sm text-muted">
                  Permite el acceso a la cámara para iniciar el escaneo.
                </p>
              </motion.div>
            ) : null}

            {detecting ? (
              <motion.div
                key="detect"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="pointer-events-auto flex w-full max-w-sm flex-col items-center gap-3"
              >
                <FramingHint face={face} scanning={false} />
                {timedOut ? (
                  <button type="button" onClick={beginScan} className="btn-primary w-full">
                    ESCANEAR DE TODAS FORMAS
                  </button>
                ) : (
                  <p className="hud-label text-center normal-case tracking-normal">
                    Mantén la cara quieta bro
                  </p>
                )}
              </motion.div>
            ) : null}

            {scanning ? (
              <motion.div
                key="scan"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex w-full flex-col items-center gap-4"
              >
                <FramingHint face={face} scanning />
                <ScanProgress sequence={sequence} />
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="pointer-events-auto flex flex-col items-center gap-2">
            <PrivacyNote className="text-center" />
            <DisclaimerBadge />
          </div>
        </div>
      </div>
    </main>
  );
}
