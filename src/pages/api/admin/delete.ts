import type { APIRoute } from "astro";
import { PREFIX } from "../../../lib/photos";
import { isAuthorised } from "../../../lib/admin";

export const prerender = false;

const ID_PATTERN = /^[0-9]{13}-[0-9a-f]{8}\.jpg$/;

export const POST: APIRoute = async ({ request, locals }) => {
  if (!isAuthorised(request)) {
    return json({ error: "Wrong passcode" }, 403);
  }

  const body = (await request.json().catch(() => null)) as { id?: string } | null;
  const id = body?.id;
  if (!id || !ID_PATTERN.test(id)) {
    return json({ error: "Unknown photo" }, 400);
  }

  const bucket = locals.runtime.env.PHOTOS;
  const key = `${PREFIX}${id}`;

  await bucket.delete(key);

  // R2 reads lag behind writes here, so confirm with head() rather than trusting
  // a follow-up list — a listing can still report a deleted object for minutes.
  const stillPresent = (await bucket.head(key)) !== null;

  return json({ id, deleted: !stillPresent }, 200);
};

// A passcode check that only runs in the browser is no check at all, so the page
// verifies against this before showing the grid's controls.
export const PUT: APIRoute = async ({ request }) => {
  return json({ ok: isAuthorised(request) }, isAuthorised(request) ? 200 : 403);
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
