/**
 * AES-256-GCM encryption/decryption using Web Crypto API.
 * Derives a per-user key from the app ENCRYPTION_KEY + userId using HKDF.
 * Compatible with Cloudflare Workers runtime.
 */

const ALGO = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits recommended for AES-GCM

/** Derive a user-specific AES key from the master key + userId */
async function deriveKey(masterKey: string, userId: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();

  // Import master key as raw key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(masterKey),
    'HKDF',
    false,
    ['deriveKey'],
  );

  // Derive a user-specific key using HKDF
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: encoder.encode(`ledgr-user-${userId}`),
      info: encoder.encode('ledgr-encryption-v1'),
    },
    keyMaterial,
    { name: ALGO, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Convert ArrayBuffer to base64 string */
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** Convert base64 string to ArrayBuffer */
function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export interface EncryptedPayload {
  ciphertext: string; // base64
  iv: string; // base64
}

/** Encrypt a JSON-serializable object */
export async function encrypt(
  data: Record<string, unknown>,
  masterKey: string,
  userId: string,
): Promise<EncryptedPayload> {
  const key = await deriveKey(masterKey, userId);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const plaintext = new TextEncoder().encode(JSON.stringify(data));

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGO, iv },
    key,
    plaintext,
  );

  return {
    ciphertext: bufferToBase64(ciphertext),
    iv: bufferToBase64(iv.buffer),
  };
}

/** Decrypt back to a JSON object */
export async function decrypt<T = Record<string, unknown>>(
  payload: EncryptedPayload,
  masterKey: string,
  userId: string,
): Promise<T> {
  const key = await deriveKey(masterKey, userId);
  const iv = new Uint8Array(base64ToBuffer(payload.iv));
  const ciphertext = base64ToBuffer(payload.ciphertext);

  const plaintext = await crypto.subtle.decrypt(
    { name: ALGO, iv },
    key,
    ciphertext,
  );

  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}

/** Create a fingerprint hash for deduplication */
export async function fingerprint(parts: string[]): Promise<string> {
  const data = new TextEncoder().encode(parts.join('|'));
  const hash = await crypto.subtle.digest('SHA-256', data);
  return bufferToBase64(hash).slice(0, 32); // Truncate for storage efficiency
}
