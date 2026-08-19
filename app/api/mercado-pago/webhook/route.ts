import { NextResponse } from 'next/server';
import { logServerError } from '@/lib/api/http';
import {
  parseNotification,
  processNotification,
  verifyWebhookSignature,
} from '@/lib/mercado-pago/webhook';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/mercado-pago/webhook
 *
 * Contract with the provider: always answer 200 quickly for anything we have
 * accepted or intentionally ignored, so Mercado Pago stops retrying. Only a
 * genuine processing failure returns 500 (which asks for a retry), and a bad
 * signature returns 401.
 *
 * The notification body is never trusted for state — see lib/mercado-pago/webhook.ts.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const notification = parseNotification(body, url.searchParams);

  const verification = verifyWebhookSignature({
    signatureHeader: request.headers.get('x-signature'),
    requestId: request.headers.get('x-request-id'),
    dataId: notification.dataId,
  });

  if (!verification.valid) {
    logServerError('webhook', new Error(`rejected: ${verification.reason}`));
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  try {
    const outcome = await processNotification(notification);
    // Acknowledge either way; `handled:false` means "nothing for us to do".
    return NextResponse.json({ received: true, ...outcome }, { status: 200 });
  } catch (error) {
    logServerError('webhook:process', error);
    // 500 asks Mercado Pago to retry, which is what we want for transient faults.
    return NextResponse.json({ error: 'processing_failed' }, { status: 500 });
  }
}

/** Some Mercado Pago integrations ping the endpoint with GET first. */
export async function GET() {
  return NextResponse.json({ ok: true });
}
