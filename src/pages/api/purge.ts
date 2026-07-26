import type { APIRoute } from "astro";
import { PREFIX } from "../../lib/photos";

export const prerender = false;

// TEMPORARY: one-shot cleanup of the QA images left in the bucket, removed again
// once the bucket is verifiably empty. The token lives in code because Webflow
// Cloud drops `vars` from wrangler.json — see the README.
const PURGE_TOKEN = "2fed7efe36e48a8805678044c9b6a9d5";

// R2's list() is eventually consistent: a single pass deleted only what listing
// happened to report, and objects written minutes earlier surfaced afterwards.
// Sweep repeatedly, and treat "empty" as advisory — the caller re-runs this
// until several consecutive passes come back with nothing.
const MAX_SWEEPS = 12;

export const POST: APIRoute = async ({ request, locals }) => {
  if (request.headers.get("x-purge-token") !== PURGE_TOKEN) {
    return json({ error: "Forbidden" }, 403);
  }

  const bucket = locals.runtime.env.PHOTOS;
  const deleted: string[] = [];

  for (let sweep = 0; sweep < MAX_SWEEPS; sweep += 1) {
    const listing = await bucket.list({ prefix: PREFIX, limit: 1000 });
    const keys = listing.objects.map((object) => object.key);
    if (keys.length === 0) break;

    await bucket.delete(keys);
    deleted.push(...keys);
  }

  const remaining = await bucket.list({ prefix: PREFIX, limit: 1000 });

  return json(
    {
      deleted: deleted.length,
      keys: deleted,
      remainingReported: remaining.objects.length,
    },
    200,
  );
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
