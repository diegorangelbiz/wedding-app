// R2 lists keys in ascending lexicographic order. Storing an inverted timestamp
// makes that order newest-first, so the slideshow can fetch recent photos
// without paging through the whole bucket.
const MAX_TIMESTAMP = 9999999999999;

export const PREFIX = "photos/";

export function buildKey(uploadedAt: number): string {
  const inverted = String(MAX_TIMESTAMP - uploadedAt).padStart(13, "0");
  const suffix = crypto.randomUUID().slice(0, 8);
  return `${PREFIX}${inverted}-${suffix}.jpg`;
}

export function timestampFromKey(key: string): number {
  const inverted = Number(key.slice(PREFIX.length, PREFIX.length + 13));
  return MAX_TIMESTAMP - inverted;
}
