// @ts-check
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";

// Must match the mount path of the Webflow Cloud environment, or deploys fail
// with ENVIRONMENT_MOUNT_MISMATCH.
const BASE_PATH = "/photo";

export default defineConfig({
  output: "server",
  adapter: cloudflare({ imageService: "passthrough" }),
  base: BASE_PATH,
  build: {
    assetsPrefix: BASE_PATH,
  },
  security: {
    // Astro's built-in check compares the Origin header against the request URL.
    // Behind Webflow Cloud's proxy the worker sees a rewritten URL, so every
    // upload 403s even from the site's own pages. The upload route does its own
    // origin allowlisting instead — see src/pages/api/upload.ts.
    checkOrigin: false,
  },
});
