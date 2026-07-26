import type { APIRoute } from "astro";
import { PREFIX } from "../../lib/photos";

export const prerender = false;

// TEMPORARY: one-shot cleanup of the QA images left in the bucket. Deletes every
// stored photo, so it is removed again immediately after use rather than left
// deployed. The token lives in code because Webflow Cloud drops `vars` from
// wrangler.json — see the README.
const PURGE_TOKEN = "2fed7efe36e48a8805678044c9b6a9d5";

export const POST: APIRoute = async ({ request, locals }) => {
  if (request.headers.get("x-purge-token") !== PURGE_TOKEN) {
    return json({ error: "Forbidden" }, 403);
  }

  const bucket = locals.runtime.env.PHOTOS;
  const deleted: string[] = [];

  // list() pages at 1000 keys; loop until the bucket reports no more.
  for (;;) {
    const listing = await bucket.list({ prefix: PREFIX, limit: 1000 });
    const keys = listing.objects.map((object) => object.key);
    if (keys.length === 0) break;

    await bucket.delete(keys);
    deleted.push(...keys);

    if (!listing.truncated) break;
  }

  return json({ deleted: deleted.length, keys: deleted }, 200);
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
