const CODE_VERIFIER_LENGTH = 64;
const PKCE_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

export function generateCodeVerifier(length = CODE_VERIFIER_LENGTH): string {
  const randomValues = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(randomValues, (byte) => PKCE_CHARSET[byte % PKCE_CHARSET.length]).join("");
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  // Base64Url encoding (no padding, URL-safe characters)
  const base64 = btoa(String.fromCharCode(...hashArray));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
