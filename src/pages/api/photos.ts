import type { APIRoute } from "astro";
import { PREFIX, timestampFromKey } from "../../lib/photos";

export const prerender = false;

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

export const GET: APIRoute = async ({ url, locals }) => {
  const bucket = locals.runtime.env.PHOTOS;

  const requested = Number(url.searchParams.get("limit"));
  const limit = Math.min(
    Number.isFinite(requested) && requested > 0 ? requested : DEFAULT_LIMIT,
    MAX_LIMIT,
  );

  const listing = await bucket.list({ prefix: PREFIX, limit });

  const photos = listing.objects.map((object) => ({
    id: object.key.slice(PREFIX.length),
    uploadedAt: timestampFromKey(object.key),
  }));

  return new Response(JSON.stringify({ photos }), {
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
};
