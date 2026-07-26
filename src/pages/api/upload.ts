import type { APIRoute } from "astro";
import { buildKey, idFromKey, type PhotoKind } from "../../lib/photos";
import { isAuthorised } from "../../lib/admin";

export const prerender = false;

const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;
  const bucket = env.PHOTOS;

  if (!isAllowedOrigin(request, env.ALLOWED_ORIGINS)) {
    return json({ error: "Forbidden" }, 403);
  }

  const form = await request.formData();
  const file = form.get("photo");

  if (!(file instanceof File)) {
    return json({ error: "No photo provided" }, 400);
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return json({ error: "Unsupported image type" }, 415);
  }
  if (file.size > MAX_BYTES) {
    return json({ error: "Photo is too large" }, 413);
  }

  // Seed photos never age out of the slideshow, so only the admin page may
  // create them — otherwise a guest could pin their own photo for the night.
  const kind: PhotoKind = form.get("kind") === "seed" ? "seed" : "guest";
  if (kind === "seed" && !isAuthorised(request)) {
    return json({ error: "Wrong passcode" }, 403);
  }

  const uploadedAt = Date.now();
  const key = buildKey(uploadedAt, kind);

  await bucket.put(key, await file.arrayBuffer(), {
    httpMetadata: {
      contentType: file.type,
      cacheControl: "public, max-age=31536000, immutable",
    },
    customMetadata: { uploadedAt: String(uploadedAt), kind },
  });

  return json({ id: idFromKey(key, kind), uploadedAt, kind }, 201);
};

// Domains the capture page is served from. Suffix matches, so the apex, www, any
// future subdomain, and the *.webflow.io staging URL all pass without edits.
//
// A same-origin check is impossible here: behind Webflow Cloud's proxy the worker
// only ever sees Host = <env-id>.wf-app-prod.cosmic.webflow.services, with no
// x-forwarded-host. Origin is the sole header carrying the public hostname —
// which is also why Astro's own checkOrigin had to be disabled.
const ALLOWED_DOMAIN_SUFFIXES = ["aileendiego.com", "webflow.io"];
const ALLOWED_EXACT_HOSTS = ["localhost", "127.0.0.1"];

// Stops another site from driving visitors' browsers into uploading here. It is
// deliberately permissive: Origin is client-controlled and the endpoint is public
// by design, so this only deters casual cross-site embedding. A false positive
// costs a guest their photo, so anything ambiguous is allowed through.
function isAllowedOrigin(request: Request, allowList?: string): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  let host: string;
  try {
    host = new URL(origin).hostname.toLowerCase();
  } catch {
    return true;
  }

  const configured = (allowList ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  const suffixes = [...ALLOWED_DOMAIN_SUFFIXES, ...configured];
  if (suffixes.some((s) => host === s || host.endsWith(`.${s}`))) return true;

  return ALLOWED_EXACT_HOSTS.includes(host);
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
