/**
 * AES-256-GCM encryption with per-record nonce
 * Format: base64url(iv):base64url(ciphertext:authTag)
 */

const IV_LENGTH = 12; // 96 bits for GCM
const ALGORITHM = "AES-GCM";

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function importKey(keyHex: string): Promise<CryptoKey> {
  if (!keyHex || typeof keyHex !== "string") {
    throw new Error("Encryption key must be a non-empty string");
  }

  if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error("Encryption key must be exactly 64 hex characters (32 bytes)");
  }

  const hexPairs = keyHex.match(/.{2}/g)!;
  const keyBytes = new Uint8Array(hexPairs.length);

  for (const [i, hexPair] of hexPairs.entries()) {
    const byte = parseInt(hexPair, 16);
    if (Number.isNaN(byte)) {
      throw new Error(`Invalid hex byte at position ${i * 2}: "${hexPair}"`);
    }
    keyBytes[i] = byte;
  }

  return crypto.subtle.importKey("raw", keyBytes.buffer, { name: ALGORITHM }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export interface EncryptedData {
  ciphertext: string;
  iv: string;
}

/**
 * Encrypts plaintext using AES-256-GCM with a random IV
 * @param plaintext - The string to encrypt
 * @param keyHex - 32-byte key as hex string (64 characters)
 * @returns Object containing base64url-encoded ciphertext and IV
 */
export async function encrypt(plaintext: string, keyHex: string): Promise<EncryptedData> {
  const key = await importKey(keyHex);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  const ciphertextBuffer = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, data);

  return {
    ciphertext: base64UrlEncode(ciphertextBuffer),
    iv: base64UrlEncode(iv.buffer),
  };
}

/**
 * Decrypts ciphertext using AES-256-GCM
 * @param encrypted - Object containing base64url-encoded ciphertext and IV
 * @param keyHex - 32-byte key as hex string (64 characters)
 * @returns Decrypted plaintext string
 */
export async function decrypt(encrypted: EncryptedData, keyHex: string): Promise<string> {
  const key = await importKey(keyHex);
  const iv = base64UrlDecode(encrypted.iv);
  const ciphertext = base64UrlDecode(encrypted.ciphertext);

  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: iv.buffer as ArrayBuffer },
    key,
    ciphertext.buffer as ArrayBuffer,
  );

  const decoder = new TextDecoder();
  return decoder.decode(plaintextBuffer);
}

/**
 * Encrypts plaintext and returns a single string format: iv:ciphertext
 * @param plaintext - The string to encrypt
 * @param keyHex - 32-byte key as hex string (64 characters)
 * @returns Combined string in format "iv:ciphertext"
 */
export async function encryptToString(plaintext: string, keyHex: string): Promise<string> {
  const { iv, ciphertext } = await encrypt(plaintext, keyHex);
  return `${iv}:${ciphertext}`;
}

/**
 * Decrypts a string in format "iv:ciphertext"
 * @param encryptedString - Combined string in format "iv:ciphertext"
 * @param keyHex - 32-byte key as hex string (64 characters)
 * @returns Decrypted plaintext string
 */
export async function decryptFromString(encryptedString: string, keyHex: string): Promise<string> {
  const [iv, ciphertext] = encryptedString.split(":");
  if (!iv || !ciphertext) {
    throw new Error("Invalid encrypted string format. Expected 'iv:ciphertext'");
  }
  return decrypt({ iv, ciphertext }, keyHex);
}
