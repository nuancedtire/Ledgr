import type { APIRoute } from 'astro';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  getAuthorizationUrl,
  generateSessionId,
} from '../../../lib/auth';

export const GET: APIRoute = async ({ locals, redirect }) => {
  const env = locals.runtime.env;

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateSessionId();
  const redirectUri = `${env.APP_URL}/api/auth/callback`;

  // Store PKCE verifier and state in KV (short TTL)
  await env.SESSIONS.put(
    `pkce:${state}`,
    JSON.stringify({ codeVerifier }),
    { expirationTtl: 600 }, // 10 minutes
  );

  const authUrl = getAuthorizationUrl(
    env.ENTRA_TENANT_ID,
    env.ENTRA_CLIENT_ID,
    redirectUri,
    codeChallenge,
    state,
  );

  return redirect(authUrl);
};
