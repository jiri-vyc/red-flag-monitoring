/** Offset of a numeric page cursor; null, NaN, a negative or a fractional value reads as the first page. */
export function parseOffsetCursor(cursor: string | null): number {
  const offset = Number(cursor ?? 0);
  return Number.isSafeInteger(offset) && offset >= 0 ? offset : 0;
}
