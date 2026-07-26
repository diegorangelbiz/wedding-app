import type { APIRoute } from "astro";
import { PREFIX } from "../../../lib/photos";

export const prerender = false;

export const GET: APIRoute = async ({ params, locals }) => {
  const bucket = locals.runtime.env.PHOTOS;

  const key = params.key;
  if (!key || !/^[0-9]{13}-[0-9a-f]{8}\.jpg$/.test(key)) {
    return new Response("Not found", { status: 404 });
  }

  const object = await bucket.get(`${PREFIX}${key}`);
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
