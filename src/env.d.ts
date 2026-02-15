/// <reference path="../.astro/types.d.ts" />

type Runtime = import('@astrojs/cloudflare').Runtime<{
  DB: D1Database;
  SESSIONS: KVNamespace;
  ASSETS: Fetcher;
  ENTRA_CLIENT_ID: string;
  ENTRA_TENANT_ID: string;
  ENTRA_CLIENT_SECRET: string;
  ENTRA_REDIRECT_URI: string;
  ENCRYPTION_KEY: string;
  APP_URL: string;
}>;

declare namespace App {
  interface Locals extends Runtime {
    user?: {
      id: string;
      email: string;
      displayName: string;
    };
    session?: {
      id: string;
      userId: string;
    };
  }
}
