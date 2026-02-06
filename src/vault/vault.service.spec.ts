import { Test, TestingModule } from '@nestjs/testing';
import { VaultService } from './vault.service';
import { ConfigService } from '@nestjs/config';

describe('VaultService', () => {
  let service: VaultService;
  let configService: ConfigService;

  const mockEncryptionKey = 'test-encryption-key-for-testing-purposes-only';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VaultService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'VAULT_ENCRYPTION_KEY') {
                return mockEncryptionKey;
              }
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<VaultService>(VaultService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt a string correctly', async () => {
      const plaintext = 'my-secret-data';
      const encrypted = await service.encrypt(plaintext);

      expect(encrypted).toBeDefined();
      expect(encrypted).not.toEqual(plaintext);
      expect(service.isEncrypted(encrypted)).toBe(true);

      const decrypted = await service.decrypt(encrypted);
      expect(decrypted).toEqual(plaintext);
    });

    it('should produce different ciphertext for same plaintext', async () => {
      const plaintext = 'same-data';
      const encrypted1 = await service.encrypt(plaintext);
      const encrypted2 = await service.encrypt(plaintext);

      expect(encrypted1).not.toEqual(encrypted2);

      const decrypted1 = await service.decrypt(encrypted1);
      const decrypted2 = await service.decrypt(encrypted2);
      expect(decrypted1).toEqual(decrypted2).toEqual(plaintext);
    });

    it('should handle special characters and unicode', async () => {
      const plaintext = '🔐 Special chars: äöü !@#$%^&*()';
      const encrypted = await service.encrypt(plaintext);
      const decrypted = await service.decrypt(encrypted);

      expect(decrypted).toEqual(plaintext);
    });

    it('should throw error when encrypting empty string', async () => {
      await expect(service.encrypt('')).rejects.toThrow('Plaintext cannot be empty');
    });

    it('should throw error when decrypting invalid data', async () => {
      await expect(service.decrypt('invalid-format')).rejects.toThrow();
    });

    it('should throw error when decrypting empty string', async () => {
      await expect(service.decrypt('')).rejects.toThrow('Encrypted data cannot be empty');
    });
  });

  describe('encryptObject and decryptObject', () => {
    it('should encrypt and decrypt objects', async () => {
      const data = {
        accessToken: 'access-token-value',
        refreshToken: 'refresh-token-value',
        expiresIn: 3600,
      };

      const encrypted = await service.encryptObject(data);
      const decrypted = await service.decryptObject<typeof data>(encrypted);

      expect(decrypted).toEqual(data);
    });

    it('should handle nested objects', async () => {
      const data = {
        user: {
          id: '123',
          profile: {
            name: 'Test User',
          },
        },
      };

      const encrypted = await service.encryptObject(data);
      const decrypted = await service.decryptObject<typeof data>(encrypted);

      expect(decrypted).toEqual(data);
    });
  });

  describe('hash', () => {
    it('should produce consistent hash for same input', () => {
      const input = 'test-input';
      const hash1 = service.hash(input);
      const hash2 = service.hash(input);

      expect(hash1).toEqual(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 produces 64 hex chars
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = service.hash('input1');
      const hash2 = service.hash('input2');

      expect(hash1).not.toEqual(hash2);
    });
  });

  describe('generateRandom', () => {
    it('should generate random hex strings', () => {
      const random1 = service.generateRandom(16);
      const random2 = service.generateRandom(16);

      expect(random1).toHaveLength(32); // 16 bytes = 32 hex chars
      expect(random2).toHaveLength(32);
      expect(random1).not.toEqual(random2);
      expect(random1).toMatch(/^[a-f0-9]+$/);
    });

    it('should generate base64url strings', () => {
      const random = service.generateRandom(32, 'base64url');

      expect(random).toBeDefined();
      // Base64url should not have +, /, or = characters
      expect(random).not.toMatch(/[+\/=]/);
    });

    it('should generate unique values', () => {
      const values = new Set();
      for (let i = 0; i < 100; i++) {
        values.add(service.generateRandom(16));
      }
      expect(values.size).toBe(100);
    });
  });

  describe('isEncrypted', () => {
    it('should return true for valid encrypted data', async () => {
      const encrypted = await service.encrypt('test');
      expect(service.isEncrypted(encrypted)).toBe(true);
    });

    it('should return false for invalid formats', () => {
      expect(service.isEncrypted('')).toBe(false);
      expect(service.isEncrypted('not-encrypted')).toBe(false);
      expect(service.isEncrypted('only.two')).toBe(false);
      expect(service.isEncrypted('too.many.parts.here')).toBe(false);
    });
  });
});
