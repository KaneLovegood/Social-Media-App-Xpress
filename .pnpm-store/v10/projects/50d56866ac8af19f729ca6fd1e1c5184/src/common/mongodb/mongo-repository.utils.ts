export function encodeOffsetCursor(offset: number): string | null {
  if (offset <= 0) return null;
  return Buffer.from(JSON.stringify({ offset }), 'utf8').toString('base64');
}

export function decodeOffsetCursor(cursor?: string): number {
  if (!cursor) return 0;

  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, 'base64').toString('utf8'),
    ) as { offset?: unknown };
    return typeof parsed.offset === 'number' && parsed.offset > 0
      ? parsed.offset
      : 0;
  } catch {
    return 0;
  }
}

export function nextOffsetCursor(
  offset: number,
  itemCount: number,
  limit: number,
): string | null {
  return itemCount >= limit ? encodeOffsetCursor(offset + itemCount) : null;
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

