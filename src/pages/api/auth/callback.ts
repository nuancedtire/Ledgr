import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import {
  exchangeCodeForTokens,
  getUserInfo,
  createSession,
  getSessionCookie,
} from '../../../lib/auth';
import { generateSalt } from '../../../lib/crypto';
import { getDb } from '../../../db';
import { users } from '../../../db/schema';

export const GET: APIRoute = async ({ url, locals }) => {
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

  // Retrieve PKCE verifier from KV
  const pkceData = await env.SESSIONS.get(`pkce:${state}`);
  if (!pkceData) {
    return new Response('Invalid or expired state. Please try logging in again.', {
      status: 400,
    });
  }

  const { codeVerifier } = JSON.parse(pkceData) as { codeVerifier: string };
  await env.SESSIONS.delete(`pkce:${state}`);

  try {
    // Exchange code for tokens
    const redirectUri = `${env.APP_URL}/api/auth/callback`;
    const tokens = await exchangeCodeForTokens(
      env.ENTRA_TENANT_ID,
      env.ENTRA_CLIENT_ID,
      redirectUri,
      code,
      codeVerifier,
    );

    // Get user info
    const userInfo = await getUserInfo(tokens.access_token);

    // Upsert user in D1
    const db = getDb(env.DB);
    const now = new Date();

    let existingUser = await db
      .select()
      .from(users)
      .where(eq(users.entraId, userInfo.sub))
      .get();

    if (!existingUser) {
      const userId = crypto.randomUUID();
      const salt = generateSalt();

      await db.insert(users).values({
        id: userId,
        entraId: userInfo.sub,
        email: userInfo.email || userInfo.preferred_username,
        displayName: userInfo.name || userInfo.preferred_username,
        encryptionSalt: salt,
        createdAt: now,
        updatedAt: now,
      });

      existingUser = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .get();
    } else {
      await db
        .update(users)
        .set({
          email: userInfo.email || userInfo.preferred_username,
          displayName: userInfo.name || userInfo.preferred_username,
          updatedAt: now,
        })
        .where(eq(users.id, existingUser.id));
    }

    if (!existingUser) {
      return new Response('Failed to create user', { status: 500 });
    }

    // Create session in KV
    const sessionId = await createSession(env.SESSIONS, {
      userId: existingUser.id,
      email: existingUser.email,
      displayName: existingUser.displayName,
      entraId: existingUser.entraId,
      expiresAt: 0, // Will be set by createSession
    });

    return new Response(null, {
      status: 302,
      headers: {
        Location: '/',
        'Set-Cookie': getSessionCookie(sessionId, env.APP_URL),
      },
    });
  } catch (err) {
    console.error('Auth callback error:', err);
    return new Response(
      `Authentication failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      { status: 500 },
    );
  }
};
