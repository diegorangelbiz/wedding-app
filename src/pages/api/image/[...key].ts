import type { APIRoute } from "astro";
import { keyFromId } from "../../../lib/photos";

export const prerender = false;

export const GET: APIRoute = async ({ params, locals }) => {
  const bucket = locals.runtime.env.PHOTOS;

  // The catch-all also carries the "seed/" prefix for the couple's own photos.
  const key = params.key ? keyFromId(params.key) : null;
  if (!key) {
    return new Response("Not found", { status: 404 });
  }

  const object = await bucket.get(key);
  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(object.body as unknown as ReadableStream, {
    headers: {
      "content-type": object.httpMetadata?.contentType ?? "image/jpeg",
      "cache-control": "public, max-age=31536000, immutable",
      etag: object.httpEtag,
    },
  });
};
