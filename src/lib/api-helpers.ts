import type { APIContext } from 'astro';
import { createAuth } from './auth';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function getEnv(context: APIContext): Env {
  const runtime = (context.locals as any).runtime;
  return runtime?.env;
}

export function getDb(env: Env) {
  return drizzle(env.DB, { schema });
}

export async function getAuthUser(context: APIContext) {
  const env = getEnv(context);
  if (!env?.DB) return null;
  const auth = createAuth(env.DB, env as any);
  const session = await auth.api.getSession({ headers: context.request.headers });
  return session;
}
