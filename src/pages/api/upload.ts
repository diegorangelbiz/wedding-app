import type { APIRoute } from "astro";
import { buildKey } from "../../lib/photos";

export const prerender = false;

const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const POST: APIRoute = async ({ request, locals }) => {
  const bucket = locals.runtime.env.PHOTOS;

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

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
