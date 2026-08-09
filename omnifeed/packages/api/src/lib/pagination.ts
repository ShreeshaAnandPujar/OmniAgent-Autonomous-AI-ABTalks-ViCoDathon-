/**
 * Cursor-based pagination helpers.
 * Cursor encodes a createdAt ISO timestamp as base64.
 */

export function encodeCursor(createdAt: Date): string {
  return Buffer.from(createdAt.toISOString()).toString('base64url');
}

export function decodeCursor(cursor: string): Date | undefined {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf-8');
    const date = new Date(decoded);
    if (isNaN(date.getTime())) return undefined;
    return date;
  } catch {
    return undefined;
  }
}
