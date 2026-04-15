import { HttpRequest } from '@azure/functions';

/** Extract and sanitize a string input; strip HTML/script tags. */
export function sanitize(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')    // strip HTML tags
    .replace(/[^\w\s\-.,!?']/g, '') // allow safe chars only
    .trim()
    .slice(0, 200);              // hard length cap
}

/** Normalize word cloud text: lowercase, trim, collapse whitespace, strip punctuation edges. */
export function normalizeWordCloudText(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^\w\s\-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 25);
}

/** Profanity filter stub – replace with real implementation or Azure Content Safety. */
export function isProfane(_text: string): boolean {
  // TODO: Integrate Azure AI Content Safety or a curated word list
  return false;
}

/** Simple rate-limit tracker (in-memory; for single-instance dev). */
const rateLimitMap = new Map<string, number>();

export function isRateLimited(deviceId: string, windowMs: number): boolean {
  const now = Date.now();
  const last = rateLimitMap.get(deviceId) || 0;
  if (now - last < windowMs) return true;
  rateLimitMap.set(deviceId, now);
  // Prune old entries periodically
  if (rateLimitMap.size > 10000) {
    const cutoff = now - windowMs * 2;
    for (const [k, v] of rateLimitMap) {
      if (v < cutoff) rateLimitMap.delete(k);
    }
  }
  return false;
}

/** Validate request body exists and has required fields. */
export async function parseBody<T>(req: HttpRequest): Promise<T> {
  const body = await req.json() as T;
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid request body');
  }
  return body;
}

/** Get device ID from header or body (cookie-based on client side). */
export function getDeviceId(req: HttpRequest, bodyDeviceId?: string): string {
  return (
    req.headers.get('x-device-id') ||
    bodyDeviceId ||
    'unknown'
  );
}
