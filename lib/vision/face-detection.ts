'use client';

/**
 * Local face presence detection.
 *
 * Scope, deliberately narrow: answer "is there a face roughly centred in
 * frame?" and nothing else.
 *
 *  - Runs 100% in the browser. No frame ever leaves the device.
 *  - No identity, no landmarks stored, no attributes inferred.
 *  - The result feeds the HUD animation only. It never touches the score —
 *    see lib/aura/aura-engine.ts.
 *
 * Primary path is MediaPipe's short-range face detector. When it cannot load
 * (offline, blocked CDN, unsupported device) we fall back to a presence
 * heuristic based on local contrast and motion, which classifies nothing about
 * the person — it only asks whether *something* is there and moving.
 */

export interface FaceBox {
  /** Normalized 0..1, relative to the video's intrinsic size. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FaceObservation {
  present: boolean;
  box: FaceBox | null;
  /** 0..1 confidence. Synthetic for the fallback detector. */
  confidence: number;
  source: 'mediapipe' | 'heuristic';
}

const MODEL_URL =
  process.env.NEXT_PUBLIC_FACE_MODEL_URL ??
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

const WASM_PATH =
  process.env.NEXT_PUBLIC_MEDIAPIPE_WASM_PATH ??
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm';

interface MediapipeDetector {
  detectForVideo: (
    video: HTMLVideoElement,
    timestamp: number,
  ) => {
    detections: {
      boundingBox?: { originX: number; originY: number; width: number; height: number };
      categories?: { score: number }[];
    }[];
  };
  close: () => void;
}

export class AuraFaceDetector {
  private detector: MediapipeDetector | null = null;
  private mode: 'mediapipe' | 'heuristic' | 'pending' = 'pending';
  private lastTimestamp = -1;

  /** Scratch canvas for the heuristic path. Tiny on purpose. */
  private canvas: HTMLCanvasElement | null = null;
  private previousFrame: Float32Array | null = null;

  get source(): 'mediapipe' | 'heuristic' | 'pending' {
    return this.mode;
  }

  /**
   * Loads the model. Never throws: a failure downgrades to the heuristic so
   * the experience always starts.
   */
  async init(): Promise<void> {
    if (this.mode !== 'pending') return;
    try {
      const vision = await import('@mediapipe/tasks-vision');
      const fileset = await vision.FilesetResolver.forVisionTasks(WASM_PATH);
      const detector = await vision.FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        minDetectionConfidence: 0.5,
      });
      this.detector = detector as unknown as MediapipeDetector;
      this.mode = 'mediapipe';
    } catch {
      this.mode = 'heuristic';
    }
  }

  detect(video: HTMLVideoElement, timestamp: number): FaceObservation {
    if (this.mode === 'mediapipe' && this.detector) {
      return this.detectWithMediapipe(video, timestamp);
    }
    return this.detectHeuristically(video);
  }

  private detectWithMediapipe(video: HTMLVideoElement, timestamp: number): FaceObservation {
    // MediaPipe requires strictly increasing timestamps in VIDEO mode.
    const ts = timestamp <= this.lastTimestamp ? this.lastTimestamp + 1 : timestamp;
    this.lastTimestamp = ts;

    try {
      const result = this.detector!.detectForVideo(video, ts);
      const detection = result.detections?.[0];
      const box = detection?.boundingBox;
      if (!detection || !box) {
        return { present: false, box: null, confidence: 0, source: 'mediapipe' };
      }
      const vw = video.videoWidth || 1;
      const vh = video.videoHeight || 1;
      return {
        present: true,
        confidence: detection.categories?.[0]?.score ?? 0.9,
        source: 'mediapipe',
        box: {
          x: box.originX / vw,
          y: box.originY / vh,
          width: box.width / vw,
          height: box.height / vh,
        },
      };
    } catch {
      // A single bad frame should not kill the loop.
      return { present: false, box: null, confidence: 0, source: 'mediapipe' };
    }
  }

  /**
   * Fallback: measure local contrast and frame-to-frame change inside the
   * central oval. High contrast + some movement in the middle of frame is a
   * good enough proxy for "a person is there", and it reads nothing about who
   * that person is.
   */
  private detectHeuristically(video: HTMLVideoElement): FaceObservation {
    const W = 48;
    const H = 64;
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.width = W;
      this.canvas.height = H;
    }
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx || video.readyState < 2) {
      return { present: false, box: null, confidence: 0, source: 'heuristic' };
    }

    ctx.drawImage(video, 0, 0, W, H);
    const { data } = ctx.getImageData(0, 0, W, H);

    const luma = new Float32Array(W * H);
    for (let i = 0; i < W * H; i += 1) {
      const r = data[i * 4] as number;
      const g = data[i * 4 + 1] as number;
      const b = data[i * 4 + 2] as number;
      luma[i] = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    }

    // Central oval mask.
    let sum = 0;
    let sumSq = 0;
    let count = 0;
    let motion = 0;
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        const nx = (x - W / 2) / (W * 0.32);
        const ny = (y - H / 2) / (H * 0.34);
        if (nx * nx + ny * ny > 1) continue;
        const index = y * W + x;
        const value = luma[index] as number;
        sum += value;
        sumSq += value * value;
        count += 1;
        if (this.previousFrame) {
          motion += Math.abs(value - (this.previousFrame[index] as number));
        }
      }
    }

    this.previousFrame = luma;
    if (count === 0) return { present: false, box: null, confidence: 0, source: 'heuristic' };

    const mean = sum / count;
    const variance = sumSq / count - mean * mean;
    const motionScore = motion / count;

    // Contrast in the middle of frame, plus either recent movement or enough
    // structure to not be a flat wall.
    const structural = Math.min(1, variance / 0.012);
    const kinetic = Math.min(1, motionScore / 0.02);
    const confidence = Math.min(1, structural * 0.75 + kinetic * 0.35);
    const present = confidence > 0.55;

    return {
      present,
      confidence,
      source: 'heuristic',
      box: present ? { x: 0.28, y: 0.2, width: 0.44, height: 0.5 } : null,
    };
  }

  dispose(): void {
    try {
      this.detector?.close();
    } catch {
      /* already closed */
    }
    this.detector = null;
    this.previousFrame = null;
    this.canvas = null;
    this.mode = 'pending';
  }
}

export type FaceFraming = 'searching' | 'too_far' | 'off_center' | 'good';

/** Turns a raw observation into the coaching hint shown over the camera. */
export function evaluateFraming(observation: FaceObservation): FaceFraming {
  if (!observation.present || !observation.box) return 'searching';
  const { x, y, width, height } = observation.box;
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  // Generous bounds: this is theatre, not a biometric gate.
  if (width < 0.16 || height < 0.16) return 'too_far';
  if (Math.abs(centerX - 0.5) > 0.24 || Math.abs(centerY - 0.46) > 0.26) return 'off_center';
  return 'good';
}
