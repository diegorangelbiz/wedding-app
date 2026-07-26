// @ts-check
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";

const BASE_PATH = "/app";

export default defineConfig({
  output: "server",
  adapter: cloudflare({ imageService: "passthrough" }),
  base: BASE_PATH,
  build: {
    assetsPrefix: BASE_PATH,
  },
});
