'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { track } from '@/lib/analytics';

export type CameraStatus = 'idle' | 'requesting' | 'ready' | 'denied' | 'unavailable';

/**
 * Front camera access.
 *
 * The stream is attached to a <video> and never recorded, uploaded or drawn
 * into anything that leaves the page. Stopping the hook stops every track, so
 * the camera light goes out the moment the scan screen unmounts.
 */
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>('idle');

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const start = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setStatus('unavailable');
      return;
    }
    setStatus('requesting');
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 720 },
            height: { ideal: 1280 },
            frameRate: { ideal: 30, max: 30 },
          },
          audio: false,
        });
      } catch {
        try {
          // Fallback 1: Simplified user facing constraint
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user' },
            audio: false,
          });
        } catch {
          // Fallback 2: Any available camera
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // iOS needs an explicit play() after srcObject, even with autoplay.
        await videoRef.current.play().catch(() => undefined);
      }
      setStatus('ready');
      track('camera_allowed');
    } catch (error) {
      const name = error instanceof DOMException ? error.name : 'Error';
      const denied = name === 'NotAllowedError' || name === 'SecurityError';
      setStatus(denied ? 'denied' : 'unavailable');
      track('camera_denied', { reason: denied ? 'permission' : 'unavailable' });
    }
  }, []);

  /**
   * Re-attaches the stream whenever the <video> is (re)mounted.
   *
   * `start()` can resolve before the element exists — e.g. restarting the
   * scanner from the result screen, where the video is unmounted at the moment
   * the camera is requested. Without this the stream would be live but never
   * displayed. Runs on every render on purpose; the identity check makes it a
   * no-op in the common case.
   */
  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (video && stream && video.srcObject !== stream) {
      video.srcObject = stream;
      void video.play().catch(() => undefined);
    }
  });

  useEffect(() => stop, [stop]);

  return { videoRef, status, start, stop };
}
