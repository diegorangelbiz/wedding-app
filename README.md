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
(`base: "/share"`), so the live URLs are:

- Capture (NFC tags point here): <https://www.aileendiego.com/share>
- Slideshow (venue display): <https://www.aileendiego.com/share/slideshow>

A Webflow Cloud app mounts at exactly one path, so every route sits under that
prefix — the two pages cannot live at unrelated top-level paths.

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

Then open http://localhost:8788/share (capture) and
http://localhost:8788/share/slideshow.

`wrangler dev --local` emulates R2 on disk, so uploads work without touching
Cloudflare. Plain `npm run dev` does **not** provide the R2 binding.

## Deploying to Webflow Cloud

Deploy from the CLI (`npx webflow auth login` first):

```bash
npx webflow cloud deploy --site-id 688c264bd0cd934e04a483b2 --mount /share
```

`--mount` must be passed explicitly and must match `base` in `astro.config.mjs`,
or the deploy fails with `ENVIRONMENT_MOUNT_MISMATCH`. Changing the mount path
also needs the Webflow site republished — add `--auto-publish`, but note that
publishes *all* pending changes on the site, not just this app.

Webflow Cloud reads `wrangler.json` and provisions the R2 bucket and KV namespace
automatically. The `SESSION` KV binding is required by the Astro Cloudflare
adapter even though this app does not use sessions.

### Gotchas worth knowing

These cost real debugging time:

- **`vars` in `wrangler.json` is silently dropped.** The builder merges only
  `kv_namespaces`, `r2_buckets` and `d1_databases` into its own template, so
  environment variables set that way never reach the worker.
- **The proxy rewrites `Host`.** The worker only ever sees
  `<env-id>.wf-app-prod.cosmic.webflow.services`, with no `x-forwarded-host`, so
  no same-origin check can work — `Origin` is the only header carrying the public
  hostname. This is also why `security.checkOrigin` is disabled.
- **Webflow replaces `astro.config.mjs` at build time** with a template that
  merges yours and always adds `@astrojs/react`. React and react-dom must be
  declared as dependencies or the deploy build fails.

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
