/**
 * Microsoft Entra ID (Azure AD) OAuth 2.0 + PKCE helpers.
 * Works in Cloudflare Workers runtime (Web Crypto API).
 */

export interface EntraConfig {
  clientId: string;
  tenantId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface TokenResponse {
  access_token: string;
  id_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export interface UserProfile {
  sub: string; // Entra object ID
  email: string;
  name: string;
  preferred_username: string;
}

/** Generate a random code verifier for PKCE */
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

/** Generate code challenge from verifier (S256) */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(hash));
}

/** Generate a random state parameter */
export function generateState(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

/** Build the authorization URL */
export async function getAuthorizationUrl(
  config: EntraConfig,
  state: string,
  codeVerifier: string,
): Promise<string> {
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    redirect_uri: config.redirectUri,
    scope: 'openid profile email',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    response_mode: 'query',
  });

  return `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/authorize?${params}`;
}

/** Exchange authorization code for tokens */
export async function exchangeCodeForTokens(
  config: EntraConfig,
  code: string,
  codeVerifier: string,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
    code_verifier: codeVerifier,
  });

  const resp = await fetch(
    `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    },
  );

  if (!resp.ok) {
    const error = await resp.text();
    throw new Error(`Token exchange failed: ${resp.status} ${error}`);
  }

  return resp.json() as Promise<TokenResponse>;
}

/** Decode JWT payload (no verification — tokens are from Entra directly) */
export function decodeJwtPayload(token: string): UserProfile {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT');
  const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
  return {
    sub: payload.oid || payload.sub,
    email: payload.email || payload.preferred_username || payload.upn || '',
    name: payload.name || '',
    preferred_username: payload.preferred_username || '',
  };
}

function base64UrlEncode(data: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < data.byteLength; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
