import type { APIRoute } from "astro";
import { PREFIX } from "../../lib/photos";

export const prerender = false;

// TEMPORARY: cleanup of the QA images, removed again once the bucket is
// verifiably empty. The token lives in code because Webflow Cloud drops `vars`
// from wrangler.json — see the README.
const PURGE_TOKEN = "2fed7efe36e48a8805678044c9b6a9d5";

// R2's list() proved unreliable here: it returned empty while objects that a
// direct get() still served were present, so a list-driven sweep deleted
// nothing and reported success. Accept explicit ids instead, and verify each
// one with a get() afterwards rather than trusting a second listing.
export const POST: APIRoute = async ({ request, locals }) => {
  if (request.headers.get("x-purge-token") !== PURGE_TOKEN) {
    return json({ error: "Forbidden" }, 403);
  }

  const bucket = locals.runtime.env.PHOTOS;

  const body = (await request.json().catch(() => null)) as { ids?: string[] } | null;
  let keys: string[];

  if (body?.ids?.length) {
    keys = body.ids.map((id) => (id.startsWith(PREFIX) ? id : `${PREFIX}${id}`));
  } else {
    const listing = await bucket.list({ prefix: PREFIX, limit: 1000 });
    keys = listing.objects.map((object) => object.key);
  }

  if (keys.length > 0) await bucket.delete(keys);

  // Confirm per key with get(), which reflected reality when list() did not.
  const stillPresent: string[] = [];
  for (const key of keys) {
    if (await bucket.head(key)) stillPresent.push(key);
  }

  return json({ requested: keys.length, stillPresent }, 200);
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
