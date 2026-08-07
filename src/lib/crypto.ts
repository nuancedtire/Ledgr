/**
 * AES-GCM encryption/decryption using Web Crypto API.
 * Each user gets a unique encryption key derived from a master secret + per-user salt.
 * Compatible with Cloudflare Workers runtime.
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96-bit IV for AES-GCM
const SALT_LENGTH = 16;

/**
 * Generate a random salt for a new user (hex-encoded).
 */
export function generateSalt(): string {
  const salt = new Uint8Array(SALT_LENGTH);
  crypto.getRandomValues(salt);
  return bufToHex(salt);
}

/**
 * Derive a per-user AES-GCM key from the master secret and user salt.
 * Uses PBKDF2 with 100,000 iterations.
 */
async function deriveKey(masterSecret: string, userSalt: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(masterSecret),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: hexToBuf(userSalt),
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypt a plaintext string. Returns base64-encoded "iv:ciphertext".
 */
export async function encrypt(
  plaintext: string,
  masterSecret: string,
  userSalt: string,
): Promise<string> {
  const key = await deriveKey(masterSecret, userSalt);
  const iv = new Uint8Array(IV_LENGTH);
  crypto.getRandomValues(iv);

  const encoder = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoder.encode(plaintext),
  );

  // Format: base64(iv):base64(ciphertext)
  return `${bufToBase64(iv)}:${bufToBase64(new Uint8Array(ciphertext))}`;
}

/**
 * Decrypt a "iv:ciphertext" string back to plaintext.
 */
export async function decrypt(
  encrypted: string,
  masterSecret: string,
  userSalt: string,
): Promise<string> {
  const [ivB64, ctB64] = encrypted.split(':');
  if (!ivB64 || !ctB64) throw new Error('Invalid encrypted format');

  const key = await deriveKey(masterSecret, userSalt);
  const iv = base64ToBuf(ivB64);
  const ciphertext = base64ToBuf(ctB64);

  const plaintext = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext,
  );

  return new TextDecoder().decode(plaintext);
}

/**
 * Encrypt a numeric value (stored as string).
 */
export async function encryptNumber(
  value: number,
  masterSecret: string,
  userSalt: string,
): Promise<string> {
  return encrypt(String(value), masterSecret, userSalt);
}

/**
 * Decrypt back to a number.
 */
export async function decryptNumber(
  encrypted: string,
  masterSecret: string,
  userSalt: string,
): Promise<number> {
  const plaintext = await decrypt(encrypted, masterSecret, userSalt);
  return parseFloat(plaintext);
}

// ─── Encoding helpers ────────────────────────────────────────────

function bufToHex(buf: Uint8Array): string {
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function bufToBase64(buf: Uint8Array): string {
  let binary = '';
  for (const byte of buf) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToBuf(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
