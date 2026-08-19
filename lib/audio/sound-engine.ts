/**
 * Sound engine.
 *
 * Everything is synthesised with the Web Audio API instead of shipping audio
 * files: zero network cost, zero decode cost, and the scanner beeps can follow
 * the scan progress instead of being fixed-length clips.
 *
 * Autoplay policy is respected — the AudioContext is only created after a real
 * user gesture, and `resume()` is called from that same gesture.
 */

export type SoundName =
  | 'ui'
  | 'lock'
  | 'beep'
  | 'scanner'
  | 'charge'
  | 'glitch'
  | 'reveal'
  | 'legendary'
  | 'fail'
  | 'jackpot'
  | 'tick';

type Ctx = AudioContext;

let ctx: Ctx | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
/** Handles for looping sounds, so they can be stopped by name. */
const loops = new Map<string, { stop: () => void }>();

function createContext(): Ctx | null {
  if (typeof window === 'undefined') return null;
  if (ctx) return ctx;
  const AudioCtor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return null;
  ctx = new AudioCtor();
  master = ctx.createGain();
  master.gain.value = 0.6;
  master.connect(ctx.destination);
  return ctx;
}

/** Must be called from inside a user gesture handler. */
export async function unlockAudio(): Promise<void> {
  const context = createContext();
  if (!context) return;
  if (context.state === 'suspended') {
    try {
      await context.resume();
    } catch {
      // Some browsers refuse until a later gesture; the next call retries.
    }
  }
}

export function setMasterVolume(volume: number): void {
  if (master) master.gain.value = Math.max(0, Math.min(1, volume));
}

function getNoise(context: Ctx): AudioBuffer {
  if (noiseBuffer) return noiseBuffer;
  const length = context.sampleRate * 2;
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  noiseBuffer = buffer;
  return buffer;
}

interface ToneOptions {
  freq: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  /** Frequency to glide to over the duration. */
  slideTo?: number;
  delay?: number;
  detune?: number;
}

function tone(context: Ctx, options: ToneOptions): void {
  if (!master) return;
  const t0 = context.currentTime + (options.delay ?? 0);
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = options.type ?? 'sine';
  osc.frequency.setValueAtTime(options.freq, t0);
  if (options.detune) osc.detune.setValueAtTime(options.detune, t0);
  if (options.slideTo) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, options.slideTo), t0 + options.duration);
  }
  const peak = options.gain ?? 0.2;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + options.duration);
  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t0 + options.duration + 0.05);
}

interface NoiseOptions {
  duration: number;
  gain?: number;
  filterType?: BiquadFilterType;
  frequency?: number;
  sweepTo?: number;
  delay?: number;
}

function noise(context: Ctx, options: NoiseOptions): void {
  if (!master) return;
  const t0 = context.currentTime + (options.delay ?? 0);
  const source = context.createBufferSource();
  source.buffer = getNoise(context);
  const filter = context.createBiquadFilter();
  filter.type = options.filterType ?? 'bandpass';
  filter.frequency.setValueAtTime(options.frequency ?? 1200, t0);
  if (options.sweepTo) {
    filter.frequency.exponentialRampToValueAtTime(Math.max(60, options.sweepTo), t0 + options.duration);
  }
  const gain = context.createGain();
  gain.gain.setValueAtTime(options.gain ?? 0.12, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + options.duration);
  source.connect(filter).connect(gain).connect(master);
  source.start(t0);
  source.stop(t0 + options.duration + 0.05);
}

/** One-shot sounds. Safe to call when audio is unavailable — it just no-ops. */
export function playSound(name: SoundName): void {
  const context = ctx;
  if (!context || context.state !== 'running') return;

  switch (name) {
    case 'ui':
      tone(context, { freq: 880, duration: 0.07, type: 'square', gain: 0.06 });
      break;
    case 'tick':
      tone(context, { freq: 1400, duration: 0.03, type: 'square', gain: 0.03 });
      break;
    case 'beep':
      tone(context, { freq: 1180, duration: 0.09, type: 'sine', gain: 0.12 });
      break;
    case 'lock':
      // Two-step confirmation chirp: target acquired.
      tone(context, { freq: 660, duration: 0.09, type: 'triangle', gain: 0.16 });
      tone(context, { freq: 1320, duration: 0.16, type: 'triangle', gain: 0.14, delay: 0.08 });
      noise(context, { duration: 0.2, frequency: 3000, sweepTo: 600, gain: 0.06, delay: 0.05 });
      break;
    case 'charge':
      tone(context, { freq: 120, slideTo: 900, duration: 1.6, type: 'sawtooth', gain: 0.1 });
      noise(context, { duration: 1.6, frequency: 300, sweepTo: 4200, gain: 0.05 });
      break;
    case 'glitch':
      noise(context, { duration: 0.22, filterType: 'highpass', frequency: 900, gain: 0.16 });
      tone(context, { freq: 90, duration: 0.2, type: 'square', gain: 0.12 });
      tone(context, { freq: 140, duration: 0.1, type: 'square', gain: 0.1, delay: 0.12 });
      break;
    case 'fail':
      tone(context, { freq: 320, slideTo: 90, duration: 0.7, type: 'sawtooth', gain: 0.13 });
      break;
    case 'reveal':
      tone(context, { freq: 220, duration: 0.9, type: 'sine', gain: 0.16 });
      tone(context, { freq: 330, duration: 0.9, type: 'sine', gain: 0.12, delay: 0.04 });
      tone(context, { freq: 660, duration: 1.1, type: 'triangle', gain: 0.1, delay: 0.08 });
      noise(context, { duration: 0.9, frequency: 5000, sweepTo: 400, gain: 0.08 });
      break;
    case 'jackpot':
      [0, 0.09, 0.18, 0.27].forEach((delay, index) => {
        tone(context, {
          freq: 880 * Math.pow(1.26, index),
          duration: 0.3,
          type: 'square',
          gain: 0.1,
          delay,
        });
      });
      break;
    case 'legendary':
      // Sub drop, choir-ish stack, then a long shimmering tail.
      tone(context, { freq: 60, duration: 3.2, type: 'sine', gain: 0.3 });
      [220, 277, 330, 440].forEach((freq, index) => {
        tone(context, { freq, duration: 3, type: 'sine', gain: 0.09, delay: 0.15 * index });
      });
      tone(context, { freq: 1760, slideTo: 220, duration: 2.4, type: 'triangle', gain: 0.08, delay: 0.3 });
      noise(context, { duration: 2.6, frequency: 200, sweepTo: 9000, gain: 0.07 });
      break;
    case 'scanner':
      tone(context, { freq: 1000, slideTo: 1600, duration: 0.18, type: 'sine', gain: 0.08 });
      break;
  }
}

/**
 * Continuous scanner hum, tied to progress.
 * Returns a stop function; calling `startScannerLoop` twice replaces the first.
 */
export function startScannerLoop(): { setProgress: (p: number) => void; stop: () => void } {
  const context = ctx;
  const noop = { setProgress: () => {}, stop: () => {} };
  if (!context || context.state !== 'running' || !master) return noop;

  loops.get('scanner')?.stop();

  const osc = context.createOscillator();
  const sub = context.createOscillator();
  const gain = context.createGain();
  const filter = context.createBiquadFilter();

  osc.type = 'sawtooth';
  osc.frequency.value = 180;
  sub.type = 'sine';
  sub.frequency.value = 55;
  filter.type = 'lowpass';
  filter.frequency.value = 700;
  filter.Q.value = 6;

  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.07, context.currentTime + 0.4);

  osc.connect(filter);
  sub.connect(filter);
  filter.connect(gain).connect(master);
  osc.start();
  sub.start();

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    const now = context.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    osc.stop(now + 0.3);
    sub.stop(now + 0.3);
    loops.delete('scanner');
  };

  const handle = {
    /** Progress 0..1 raises the pitch and opens the filter — rising tension. */
    setProgress: (p: number) => {
      if (stopped) return;
      const now = context.currentTime;
      osc.frequency.linearRampToValueAtTime(180 + p * 420, now + 0.2);
      filter.frequency.linearRampToValueAtTime(700 + p * 2600, now + 0.2);
    },
    stop,
  };

  loops.set('scanner', { stop });
  return handle;
}

export function stopAllLoops(): void {
  for (const loop of loops.values()) loop.stop();
  loops.clear();
}
