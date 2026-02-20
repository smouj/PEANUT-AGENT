import { describe, it, expect } from 'vitest';
import { CryptoService } from '../../src/application/services/crypto.service.js';

describe('CryptoService', () => {
  const svc = new CryptoService();

  describe('hashPassword / verifyPassword', () => {
    it('hashes and verifies a password', async () => {
      const hash = await svc.hashPassword('MySecurePassword123!');
      expect(hash).toMatch(/^[a-f0-9]+:[a-f0-9]+$/);
      const valid = await svc.verifyPassword('MySecurePassword123!', hash);
      expect(valid).toBe(true);
    });

    it('returns false for wrong password', async () => {
      const hash = await svc.hashPassword('CorrectPassword');
      const valid = await svc.verifyPassword('WrongPassword', hash);
      expect(valid).toBe(false);
    });

    it('generates different hashes for same password (unique salts)', async () => {
      const h1 = await svc.hashPassword('SamePassword');
      const h2 = await svc.hashPassword('SamePassword');
      expect(h1).not.toBe(h2);
    });
  });

  describe('encryptAES256 / decryptAES256', () => {
    const key = 'a'.repeat(64);

    it('encrypts and decrypts a string', () => {
      const plaintext = 'secret-api-key-12345';
      const encrypted = svc.encryptAES256(plaintext, key);
      expect(encrypted).not.toBe(plaintext);
      const decrypted = svc.decryptAES256(encrypted, key);
      expect(decrypted).toBe(plaintext);
    });

    it('produces different ciphertexts for same plaintext (random IV)', () => {
      const plaintext = 'same secret';
      const c1 = svc.encryptAES256(plaintext, key);
      const c2 = svc.encryptAES256(plaintext, key);
      expect(c1).not.toBe(c2);
    });

    it('throws on wrong key', () => {
      const encrypted = svc.encryptAES256('secret', key);
      const wrongKey = 'b'.repeat(64);
      expect(() => svc.decryptAES256(encrypted, wrongKey)).toThrow();
    });
  });

  describe('generateSecureToken', () => {
    it('generates a hex token of correct length', () => {
      const token = svc.generateSecureToken(16);
      expect(token).toHaveLength(32); // 16 bytes = 32 hex chars
    });

    it('generates unique tokens', () => {
      const t1 = svc.generateSecureToken();
      const t2 = svc.generateSecureToken();
      expect(t1).not.toBe(t2);
    });
  });
});
