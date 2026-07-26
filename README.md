# wedding-app

Guests tap an NFC tag, take a photo on their phone, and it appears on the big-screen
slideshow within seconds. Astro + Cloudflare Workers, deployed to Webflow Cloud.

## Routes

| Route          | Purpose                                             |
| -------------- | --------------------------------------------------- |
| `/`            | Capture page — what the NFC tag points to           |
| `/slideshow`   | Fullscreen rotating slideshow for the venue display |
| `/api/upload`  | `POST` a photo (multipart, field `photo`) into R2   |
| `/api/photos`  | `GET` the photo list, newest first                  |
| `/api/image/*` | `GET` the image bytes for one photo                 |

All routes are served under the mount path configured in `astro.config.mjs`
(`base: "/app"`), so the live capture URL is `https://yoursite.com/app`.

## How it works

Photos live in an R2 bucket (`PHOTOS` binding). Object keys embed an **inverted
timestamp**, so R2's ascending lexicographic listing is already newest-first — the
slideshow gets recent photos without paging the whole bucket.

The capture page resizes each photo to 1920px and re-encodes it as JPEG *before*
uploading, which keeps uploads fast on venue wifi (a 3.4 MB shot becomes ~26 KB).

The slideshow polls `/api/photos` every 10s and cross-fades every 7s. Photos it
hasn't seen before jump to the front of the queue, so a guest sees their own shot
almost immediately — measured at ~3.5s from upload to on-screen. It preloads each
image before cross-fading so slides never flash empty.

## Local development

```bash
npm install
npm run build && npx wrangler dev --port 8788 --local
```

Then open http://localhost:8788/app (capture) and http://localhost:8788/app/slideshow.

`wrangler dev --local` emulates R2 on disk, so uploads work without touching
Cloudflare. Plain `npm run dev` does **not** provide the R2 binding.

## Deploying to Webflow Cloud

1. Push this repo to GitHub.
2. In your Webflow site, go to **Webflow Cloud** and create a project pointed at
   this repo, with the mount path set to `/app` (must match `base` in
   `astro.config.mjs`).
3. Deploy. Webflow Cloud reads `wrangler.json` and provisions the R2 bucket and KV
   namespace automatically.
4. After the first deploy, replace the placeholder `id` on the `SESSION` KV
   namespace in `wrangler.json` with the real ID from the Webflow Cloud dashboard,
   then redeploy.

The `SESSION` KV binding is required by the Astro Cloudflare adapter even though
this app does not use sessions.

## Configuration

| Where                       | Setting                      | Notes                                   |
| --------------------------- | ---------------------------- | --------------------------------------- |
| `astro.config.mjs`          | `base`, `build.assetsPrefix` | Must equal the Webflow Cloud mount path |
| `wrangler.json`             | `r2_buckets` → `PHOTOS`      | Photo storage                           |
| `src/pages/slideshow.astro` | `SLIDE_MS`, `POLL_MS`        | Slide duration and poll interval        |
| `src/pages/index.astro`     | `MAX_EDGE`, `QUALITY`        | Client-side compression settings        |

## Notes

- Version pins matter: Astro 5 + `@astrojs/cloudflare` v12 produce the
  `dist/_worker.js/index.js` layout Webflow Cloud expects. Newer versions emit
  `dist/client` + `dist/server` instead and will not deploy correctly.
- The slideshow rotates the 200 most recent photos.
- There is no delete or moderation UI. Anyone with the URL can upload.
