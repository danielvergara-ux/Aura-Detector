import 'server-only';

import { NextResponse } from 'next/server';
import { ZodError, type TypeOf, type ZodTypeAny } from 'zod';

/**
 * Shared HTTP helpers for route handlers.
 *
 * Error bodies stay generic on purpose: clients get a stable `code` they can
 * branch on, never an internal message or stack.
 */

export type ApiErrorCode =
  | 'bad_request'
  | 'rate_limited'
  | 'not_found'
  | 'no_credits'
  | 'payment_unavailable'
  | 'server_error';

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, {
    ...init,
    headers: { 'Cache-Control': 'no-store', ...(init?.headers ?? {}) },
  });
}

export function fail(code: ApiErrorCode, status: number, extra?: Record<string, unknown>): NextResponse {
  return NextResponse.json(
    { error: code, ...extra },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

/** Parses and validates a JSON body. Returns `null` when the body is invalid. */
export async function parseBody<S extends ZodTypeAny>(
  request: Request,
  schema: S,
): Promise<TypeOf<S> | null> {
  try {
    const raw = request.headers.get('content-length') === '0' ? {} : await request.json();
    return schema.parse(raw ?? {});
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) return null;
    return null;
  }
}

/** Logs an unexpected failure without leaking request contents. */
export function logServerError(scope: string, error: unknown): void {
  const message = error instanceof Error ? error.message : 'unknown error';
  console.error(`[aura:${scope}] ${message}`);
}
