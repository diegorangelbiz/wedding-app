import type { APIRoute } from "astro";
import { buildKey } from "../../lib/photos";

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

  const uploadedAt = Date.now();
  const key = buildKey(uploadedAt);

  await bucket.put(key, await file.arrayBuffer(), {
    httpMetadata: {
      contentType: file.type,
      cacheControl: "public, max-age=31536000, immutable",
    },
    customMetadata: { uploadedAt: String(uploadedAt) },
  });

  return json({ key, uploadedAt }, 201);
};

// Webflow Cloud's builder merges only kv_namespaces / r2_buckets / d1_databases
// from wrangler.json into its own template — a "vars" block is silently dropped,
// so ALLOWED_ORIGINS never reaches the worker. These defaults are the real
// enforcement; the env var stays supported in case that changes.
const DEFAULT_ALLOWED_HOSTS = [
  "www.aileendiego.com",
  "aileendiego.com",
  "wedding-app.webflow.io",
  "localhost",
];

// Keeps other sites from using this endpoint as free image hosting. Requests with
// no Origin header (curl, some native clients) are allowed through — the endpoint
// is public by design, this only blocks browsers acting for another site.
function isAllowedOrigin(request: Request, allowList?: string): boolean {
  const configured = (allowList ?? "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean);
  const allowed = configured.length > 0 ? configured : DEFAULT_ALLOWED_HOSTS;

  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    return allowed.includes(new URL(origin).hostname);
  } catch {
    return false;
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
