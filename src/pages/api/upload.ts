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

// Extra hosts beyond the site's own. Webflow Cloud's builder merges only
// kv_namespaces / r2_buckets / d1_databases from wrangler.json into its own
// template — a "vars" block is silently dropped — so ALLOWED_ORIGINS is only
// useful if that changes or when running elsewhere.
const EXTRA_ALLOWED_HOSTS = ["localhost", "127.0.0.1"];

// Stops another site from driving visitors' browsers into uploading here. It is
// deliberately permissive: the endpoint is public by design (anyone can post to
// it directly), so a false positive costs a guest their photo while buying
// almost no security. Anything ambiguous is allowed.
//
// The primary rule is a same-origin match against the Host header rather than a
// hardcoded domain list — the site is reachable on its custom domain and on
// *.webflow.io, and hardcoding meant guests on the webflow.io URL got a 403.
function isAllowedOrigin(request: Request, allowList?: string): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  let originHost: string;
  try {
    originHost = new URL(origin).hostname;
  } catch {
    return true;
  }

  const selfHost = (request.headers.get("host") ?? "").split(":")[0];
  if (selfHost && originHost === selfHost) return true;

  const configured = (allowList ?? "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean);

  return [...configured, ...EXTRA_ALLOWED_HOSTS].includes(originHost);
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
