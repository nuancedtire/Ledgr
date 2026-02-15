// AES-256-GCM encryption/decryption using Web Crypto API
// Key is derived from user ID + server secret

async function deriveKey(userId: string, secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(userId),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encrypt(
  data: string,
  userId: string,
  secret: string,
): Promise<{ encrypted: string; iv: string }> {
  const key = await deriveKey(userId, secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(data),
  );

  return {
    encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

export async function decrypt(
  encryptedB64: string,
  ivB64: string,
  userId: string,
  secret: string,
): Promise<string> {
  const key = await deriveKey(userId, secret);
  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
  const encrypted = Uint8Array.from(atob(encryptedB64), (c) => c.charCodeAt(0));

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encrypted,
  );

  return new TextDecoder().decode(decrypted);
}
