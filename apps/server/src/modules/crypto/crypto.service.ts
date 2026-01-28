import { Injectable } from "@nestjs/common";
import {
  generateCodeVerifier,
  generateCodeChallenge,
  encrypt,
  decrypt,
  encryptToString,
  decryptFromString,
  type EncryptedData,
} from "@spark/crypto";
import { env } from "@spark/env/server";

@Injectable()
export class CryptoService {
  private getEncryptionKey(keyId: string): string {
    // Support key rotation by mapping keyId to keys
    // For now, we only support "v1" which uses the primary key
    if (keyId !== "v1") {
      throw new Error(`Unknown encryption key ID: ${keyId}`);
    }
    return env.ENCRYPTION_KEY;
  }

  generateCodeVerifier(length?: number): string {
    return generateCodeVerifier(length);
  }

  generateCodeChallenge(verifier: string): Promise<string> {
    return generateCodeChallenge(verifier);
  }

  async encrypt(plaintext: string, keyId = "v1"): Promise<EncryptedData> {
    const key = this.getEncryptionKey(keyId);
    return encrypt(plaintext, key);
  }

  async decrypt(encrypted: EncryptedData, keyId: string): Promise<string> {
    const key = this.getEncryptionKey(keyId);
    return decrypt(encrypted, key);
  }

  async encryptToString(plaintext: string, keyId = "v1"): Promise<string> {
    const key = this.getEncryptionKey(keyId);
    return encryptToString(plaintext, key);
  }

  async decryptFromString(encryptedString: string, keyId: string): Promise<string> {
    const key = this.getEncryptionKey(keyId);
    return decryptFromString(encryptedString, key);
  }

  getCurrentKeyId(): string {
    return "v1";
  }
}
