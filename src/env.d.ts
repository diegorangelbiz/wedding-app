/// <reference types="astro/client" />

type Env = {
  PHOTOS: import("@cloudflare/workers-types").R2Bucket;
};

declare namespace App {
  interface Locals extends Runtime {}
}

type Runtime = import("@astrojs/cloudflare").Runtime<Env>;
