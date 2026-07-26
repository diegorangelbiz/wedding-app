import type { APIRoute } from "astro";
import {
  PREFIX,
  SEED_PREFIX,
  idFromKey,
  timestampFromKey,
  type PhotoKind,
} from "../../lib/photos";

export const prerender = false;

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;
const SEED_LIMIT = 300;

export const GET: APIRoute = async ({ url, locals }) => {
  const bucket = locals.runtime.env.PHOTOS;

  const requested = Number(url.searchParams.get("limit"));
  const limit = Math.min(
    Number.isFinite(requested) && requested > 0 ? requested : DEFAULT_LIMIT,
    MAX_LIMIT,
  );

  // Guest photos are windowed to the most recent `limit`; the couple's seed
  // photos are always returned in full, so a busy night cannot push them out.
  const [guests, seeds] = await Promise.all([
    bucket.list({ prefix: PREFIX, limit }),
    bucket.list({ prefix: SEED_PREFIX, limit: SEED_LIMIT }),
  ]);

  const describe = (key: string, kind: PhotoKind) => ({
    id: idFromKey(key, kind),
    uploadedAt: timestampFromKey(key, kind),
    kind,
  });

  const photos = [
    ...guests.objects.map((object) => describe(object.key, "guest")),
    ...seeds.objects.map((object) => describe(object.key, "seed")),
  ].sort((a, b) => b.uploadedAt - a.uploadedAt);

  return new Response(JSON.stringify({ photos }), {
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
};
