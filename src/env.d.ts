/// <reference path="../.astro/types.d.ts" />

type Runtime = import('@astrojs/cloudflare').Runtime<{
  DB: D1Database;
  SESSIONS: KVNamespace;
  ENTRA_TENANT_ID: string;
  ENTRA_CLIENT_ID: string;
  ENTRA_CLIENT_SECRET: string;
  APP_URL: string;
  ENCRYPTION_KEY_SECRET: string;
}>;

declare namespace App {
  interface Locals extends Runtime {
    session?: import('./lib/auth').AuthSession | null;
  }
}
