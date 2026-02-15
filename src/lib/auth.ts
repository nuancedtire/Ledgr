import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export function createAuth(d1: D1Database, env: Record<string, string>) {
  const db = drizzle(d1, { schema });

  return betterAuth({
    database: drizzleAdapter(db, { provider: 'sqlite' }),
    socialProviders: {
      microsoft: {
        clientId: env.MICROSOFT_CLIENT_ID,
        clientSecret: env.MICROSOFT_CLIENT_SECRET,
        tenantId: env.MICROSOFT_TENANT_ID || 'common',
      },
    },
    trustedOrigins: env.TRUSTED_ORIGINS ? env.TRUSTED_ORIGINS.split(',') : ['http://localhost:4321'],
  });
}

export type Auth = ReturnType<typeof createAuth>;
