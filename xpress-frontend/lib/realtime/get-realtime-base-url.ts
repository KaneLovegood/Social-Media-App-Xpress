/**
 * Socket.IO base URL (https:// is correct; same host as the REST API is typical).
 *
 * If NEXT_PUBLIC_WS_BASE_URL is missing, malformed, or a bogus single-label host
 * (e.g. accidental Punycode / paste errors), we fall back to NEXT_PUBLIC_API_BASE_URL.
 */
export function getRealtimeBaseUrl(): string {
  const api = normalizeBase(process.env.NEXT_PUBLIC_API_BASE_URL);
  const ws = normalizeBase(process.env.NEXT_PUBLIC_WS_BASE_URL);
  if (ws && isPlausibleHttpUrl(ws)) return ws;
  if (api && isPlausibleHttpUrl(api)) return api;
  return 'http://localhost:3000';
}

function normalizeBase(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  return raw.trim().replace(/\/$/, '');
}

function isPlausibleHttpUrl(base: string): boolean {
  try {
    const withProto = /^https?:\/\//i.test(base) ? base : `https://${base}`;
    const u = new URL(withProto);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    const { hostname } = u;
    if (hostname === 'localhost') return true;
    // Reject single-label hosts (no dot): they are almost always copy/paste or IDN mistakes.
    if (!hostname.includes('.')) return false;
    return true;
  } catch {
    return false;
  }
}
