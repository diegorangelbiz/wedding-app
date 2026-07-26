// R2 lists keys in ascending lexicographic order. Storing an inverted timestamp
// makes that order newest-first, so the slideshow can fetch recent photos
// without paging through the whole bucket.
const MAX_TIMESTAMP = 9999999999999;

export const PREFIX = "photos/";

// The couple's own photos live under their own prefix so they survive the
// newest-200 window the slideshow reads. Sharing a prefix would let a busy night
// of guest uploads push them out of rotation entirely.
export const SEED_PREFIX = "seed/";

export type PhotoKind = "guest" | "seed";

export const NAME_PATTERN = /^[0-9]{13}-[0-9a-f]{8}\.jpg$/;

export function prefixFor(kind: PhotoKind): string {
  return kind === "seed" ? SEED_PREFIX : PREFIX;
}

export function buildKey(uploadedAt: number, kind: PhotoKind = "guest"): string {
  const inverted = String(MAX_TIMESTAMP - uploadedAt).padStart(13, "0");
  const suffix = crypto.randomUUID().slice(0, 8);
  return `${prefixFor(kind)}${inverted}-${suffix}.jpg`;
}

export function timestampFromKey(key: string, kind: PhotoKind = "guest"): number {
  const start = prefixFor(kind).length;
  return MAX_TIMESTAMP - Number(key.slice(start, start + 13));
}

// Ids are what the browser sees. Guest photos stay bare so existing links keep
// working; seed photos carry their prefix so one id round-trips to one key.
export function idFromKey(key: string, kind: PhotoKind): string {
  const name = key.slice(prefixFor(kind).length);
  return kind === "seed" ? `${SEED_PREFIX}${name}` : name;
}

export function keyFromId(id: string): string | null {
  const isSeed = id.startsWith(SEED_PREFIX);
  const name = isSeed ? id.slice(SEED_PREFIX.length) : id;
  if (!NAME_PATTERN.test(name)) return null;
  return `${isSeed ? SEED_PREFIX : PREFIX}${name}`;
}
