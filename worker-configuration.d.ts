interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  MICROSOFT_CLIENT_ID: string;
  MICROSOFT_CLIENT_SECRET: string;
  MICROSOFT_TENANT_ID?: string;
  ENCRYPTION_SECRET: string;
  KILO_API_KEY: string;
  TRUSTED_ORIGINS?: string;
  BETTER_AUTH_SECRET?: string;
}
