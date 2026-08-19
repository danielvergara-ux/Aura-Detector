/**
 * Privacy-preserving analytics.
 *
 * Events carry a name and a couple of coarse properties — never a score tied
 * to an identity, never anything from the camera, never an IP or a device
 * fingerprint. If no analytics provider is present, this compiles down to a
 * no-op in production and a console line in development.
 */

export type AnalyticsEvent =
  | 'landing_view'
  | 'scan_started'
  | 'camera_allowed'
  | 'camera_denied'
  | 'face_detected'
  | 'scan_completed'
  | 'result_shared'
  | 'result_downloaded'
  | 'challenge_created'
  | 'challenge_accepted'
  | 'reroll_clicked'
  | 'checkout_started'
  | 'payment_completed'
  | 'reroll_completed'
  | 'leaderboard_view'
  | 'sound_toggled';

type Props = Record<string, string | number | boolean>;

interface AnalyticsWindow extends Window {
  plausible?: (event: string, options?: { props?: Props }) => void;
  va?: (event: 'event', payload: { name: string; data?: Props }) => void;
}

export function track(event: AnalyticsEvent, props: Props = {}): void {
  if (typeof window === 'undefined') return;
  const w = window as AnalyticsWindow;

  try {
    if (typeof w.plausible === 'function') {
      w.plausible(event, { props });
      return;
    }
    if (typeof w.va === 'function') {
      w.va('event', { name: event, data: props });
      return;
    }
  } catch {
    // Analytics must never break the experience.
  }

  if (process.env.NODE_ENV === 'development') {
    console.debug('[analytics]', event, props);
  }
}
