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
      expect(decrypted1).toEqual(decrypted2);
      expect(decrypted2).toEqual(plaintext);
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
});
