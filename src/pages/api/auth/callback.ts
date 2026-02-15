import type { APIRoute } from 'astro';
import { exchangeCodeForTokens, decodeJwtPayload } from '../../../lib/auth/entra';
import { consumeAuthState, createSession } from '../../../lib/auth/session';
import { getDb } from '../../../lib/db/client';
import { users } from '../../../lib/db/schema';
import { eq } from 'drizzle-orm';

export const GET: APIRoute = async ({ url, locals, redirect }) => {
  const env = locals.runtime.env;

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) {
    return new Response(`Authentication error: ${error}`, { status: 400 });
  }

  if (!code || !state) {
    return new Response('Missing code or state parameter', { status: 400 });
  }

  // Retrieve and validate PKCE state
  const authState = await consumeAuthState(env.SESSIONS, state);
  if (!authState) {
    return new Response('Invalid or expired state. Please try logging in again.', { status: 400 });
  }

  // Exchange code for tokens
  const tokens = await exchangeCodeForTokens(
    {
      clientId: env.ENTRA_CLIENT_ID,
      tenantId: env.ENTRA_TENANT_ID,
      clientSecret: env.ENTRA_CLIENT_SECRET,
      redirectUri: env.ENTRA_REDIRECT_URI,
    },
    code,
    authState.codeVerifier,
  );

  // Decode user profile from ID token
  const profile = decodeJwtPayload(tokens.id_token);

  // Upsert user in D1
  const db = getDb(env.DB);
  const existingUser = await db.select().from(users).where(eq(users.entraId, profile.sub)).get();

  let userId: string;
  if (existingUser) {
    userId = existingUser.id;
    await db.update(users).set({
      email: profile.email,
      displayName: profile.name,
      updatedAt: new Date(),
    }).where(eq(users.id, userId)).run();
  } else {
    userId = crypto.randomUUID();
    await db.insert(users).values({
      id: userId,
      entraId: profile.sub,
      email: profile.email,
      displayName: profile.name,
    }).run();
  }

  // Create session
  const { cookie } = await createSession(env.SESSIONS, {
    userId,
    email: profile.email,
    displayName: profile.name,
    createdAt: Date.now(),
  });

  return new Response(null, {
    status: 302,
    headers: {
      Location: '/',
      'Set-Cookie': cookie,
    },
  });
};
