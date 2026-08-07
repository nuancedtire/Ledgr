import type { APIRoute } from 'astro';
import { getAuthorizationUrl, generateCodeVerifier, generateState } from '../../../lib/auth/entra';
import { storeAuthState } from '../../../lib/auth/session';

export const GET: APIRoute = async ({ locals, redirect }) => {
  const env = locals.runtime.env;

  const state = generateState();
  const codeVerifier = generateCodeVerifier();

  // Store PKCE state in KV
  await storeAuthState(env.SESSIONS, state, { codeVerifier });

  const authUrl = await getAuthorizationUrl(
    {
      clientId: env.ENTRA_CLIENT_ID,
      tenantId: env.ENTRA_TENANT_ID,
      clientSecret: env.ENTRA_CLIENT_SECRET,
      redirectUri: env.ENTRA_REDIRECT_URI,
    },
    state,
    codeVerifier,
  );

  return redirect(authUrl);
};
