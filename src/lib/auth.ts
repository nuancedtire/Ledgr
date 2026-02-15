/**
 * Microsoft Entra ID OAuth 2.0 + PKCE authentication helpers.
 * Sessions stored in Cloudflare KV.
 */

export interface AuthSession {
  userId: string;
  email: string;
  displayName: string;
  entraId: string;
  expiresAt: number; // Unix timestamp (ms)
}

export interface EntraTokenResponse {
  access_token: string;
  id_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export interface EntraUserInfo {
  sub: string;
  email: string;
  name: string;
  preferred_username: string;
}

const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days in seconds
const SESSION_COOKIE = 'ledgr_session';

// ─── PKCE helpers ────────────────────────────────────────────────

export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

function base64UrlEncode(buf: Uint8Array): string {
  let binary = '';
  for (const byte of buf) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ─── Entra ID URLs ──────────────────────────────────────────────

export function getAuthorizationUrl(
  tenantId: string,
  clientId: string,
  redirectUri: string,
  codeChallenge: string,
  state: string,
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: 'openid profile email',
    response_mode: 'query',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params}`;
}

export async function exchangeCodeForTokens(
  tenantId: string,
  clientId: string,
  redirectUri: string,
  code: string,
  codeVerifier: string,
): Promise<EntraTokenResponse> {
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });

  const resp = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
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

  return resp.json() as Promise<EntraTokenResponse>;
}

export async function getUserInfo(accessToken: string): Promise<EntraUserInfo> {
  const resp = await fetch('https://graph.microsoft.com/oidc/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!resp.ok) {
    throw new Error(`UserInfo request failed: ${resp.status}`);
  }

  return resp.json() as Promise<EntraUserInfo>;
}

// ─── Session management (KV) ────────────────────────────────────

export function generateSessionId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function createSession(
  kv: KVNamespace,
  session: AuthSession,
): Promise<string> {
  const sessionId = generateSessionId();
  session.expiresAt = Date.now() + SESSION_TTL * 1000;

  await kv.put(`session:${sessionId}`, JSON.stringify(session), {
    expirationTtl: SESSION_TTL,
  });

  return sessionId;
}

export async function getSession(
  kv: KVNamespace,
  sessionId: string,
): Promise<AuthSession | null> {
  const data = await kv.get(`session:${sessionId}`);
  if (!data) return null;

  const session = JSON.parse(data) as AuthSession;
  if (session.expiresAt < Date.now()) {
    await kv.delete(`session:${sessionId}`);
    return null;
  }

  return session;
}

export async function deleteSession(
  kv: KVNamespace,
  sessionId: string,
): Promise<void> {
  await kv.delete(`session:${sessionId}`);
}

export function getSessionCookie(sessionId: string, appUrl: string): string {
  const secure = appUrl.startsWith('https') ? '; Secure' : '';
  return `${SESSION_COOKIE}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL}${secure}`;
}

export function getClearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function getSessionIdFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  return match?.[1] ?? null;
}
