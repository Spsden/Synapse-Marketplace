import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

/**
 * Configuration for encryption algorithms and key derivation.
 */
interface EncryptionConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
  authTagLength: number;
}

/**
 * Result of encryption operation containing encrypted data with IV.
 */
interface EncryptionResult {
  encrypted: string;
  iv: string;
  authTag?: string;
}

/**
 * Vault Service for secure encryption and decryption of sensitive data.
 *
 * Uses AES-256-GCM for authenticated encryption:
 * - Provides confidentiality (encryption)
 * - Provides integrity (authentication tag)
 * - Uses unique IV for each operation
 * - Derives encryption key from environment variable
 *
 * @example
 * ```typescript
 * const encrypted = await vaultService.encrypt('my-secret');
 * const decrypted = await vaultService.decrypt(encrypted);
 * ```
 */
@Injectable()
export class VaultService {
  private readonly logger = new Logger(VaultService.name);
  private readonly encryptionKey: Buffer;
  private readonly config: EncryptionConfig = {
    algorithm: 'aes-256-gcm',
    keyLength: 32, // 256 bits for AES-256
    ivLength: 16, // 128 bits for GCM
    authTagLength: 16, // 128 bits authentication tag
  };

  constructor(private configService: ConfigService) {
    const key = this.configService.get<string>('VAULT_ENCRYPTION_KEY');

    if (!key) {
      throw new Error(
        'VAULT_ENCRYPTION_KEY environment variable is required. ' +
          'Generate with: openssl rand -base64 32'
      );
    }

    // Derive a 32-byte key from the environment variable
    this.encryptionKey = this.deriveKey(key);
    this.logger.log('VaultService initialized with AES-256-GCM encryption');
  }

  /**
   * Encrypts plaintext data using AES-256-GCM.
   *
   * @param plaintext - The sensitive data to encrypt
   * @returns Base64 encoded string containing IV + authTag + ciphertext
   *
   * @example
   * ```typescript
   * const encrypted = await vaultService.encrypt('client_secret_123');
   * // Returns: base64(iv + authTag + ciphertext)
   * ```
   */
  async encrypt(plaintext: string): Promise<string> {
    if (!plaintext) {
      throw new Error('Plaintext cannot be empty');
    }

    try {
      // Generate a unique IV for each encryption (required for GCM)
      const iv = randomBytes(this.config.ivLength);

      // Create cipher with derived key and IV
      const cipher = createCipheriv(
        this.config.algorithm,
        this.encryptionKey,
        iv
      );

      // Encrypt the data
      let encrypted = cipher.update(plaintext, 'utf8', 'base64');
      encrypted += cipher.final('base64');

      // Get authentication tag (GCM provides integrity verification)
      const authTag = cipher.getAuthTag();

      // Combine IV + authTag + encrypted data for storage
      // Format: base64(iv) + '.' + base64(authTag) + '.' + base64(encrypted)
      const result = `${iv.toString('base64')}.${authTag.toString('base64')}.${encrypted}`;

      this.logger.debug('Data encrypted successfully');
      return result;
    } catch (error) {
      this.logger.error('Encryption failed', error.stack);
      throw new Error(`Failed to encrypt data: ${error.message}`);
    }
  }

  /**
   * Decrypts data that was encrypted using the encrypt method.
   *
   * @param encryptedData - The encrypted string in format: base64(iv).base64(authTag).base64(ciphertext)
   * @returns The original plaintext data
   * @throws Error if decryption fails or authentication tag verification fails
   *
   * @example
   * ```typescript
   * const decrypted = await vaultService.decrypt(encryptedData);
   * ```
   */
  async decrypt(encryptedData: string): Promise<string> {
    if (!encryptedData) {
      throw new Error('Encrypted data cannot be empty');
    }

    try {
      // Parse the encrypted data format
      const parts = encryptedData.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }

      const [ivBase64, authTagBase64, ciphertext] = parts;

      // Decode IV and authTag
      const iv = Buffer.from(ivBase64, 'base64');
      const authTag = Buffer.from(authTagBase64, 'base64');

      // Create decipher with key and IV
      const decipher = createDecipheriv(
        this.config.algorithm,
        this.encryptionKey,
        iv
      );

      // Set authentication tag BEFORE decryption (required for GCM)
      decipher.setAuthTag(authTag);

      // Decrypt the data
      let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      this.logger.debug('Data decrypted successfully');
      return decrypted;
    } catch (error) {
      this.logger.error('Decryption failed', error.stack);
      throw new Error(`Failed to decrypt data: ${error.message}`);
    }
  }

  /**
   * Encrypts an object by first serializing it to JSON.
   *
   * @param data - The object to encrypt
   * @returns Base64 encoded encrypted string
   *
   * @example
   * ```typescript
   * const encrypted = await vaultService.encryptObject({
   *   accessToken: 'xxx',
   *   refreshToken: 'yyy'
   * });
   * ```
   */
  async encryptObject<T>(data: T): Promise<string> {
    const json = JSON.stringify(data);
    return this.encrypt(json);
  }

  /**
   * Decrypts data and parses it as JSON.
   *
   * @param encryptedData - The encrypted JSON string
   * @returns The parsed object
   *
   * @example
   * ```typescript
   * const tokens = await vaultService.decryptObject<Tokens>(encryptedData);
   * ```
   */
  async decryptObject<T>(encryptedData: string): Promise<T> {
    const json = await this.decrypt(encryptedData);
    return JSON.parse(json) as T;
  }

  /**
   * Hashes data using SHA-256 for one-way transformations.
   * Useful for creating deterministic identifiers from sensitive data.
   *
   * @param data - The data to hash
   * @returns Hex-encoded SHA-256 hash
   *
   * @example
   * ```typescript
   * const fingerprint = vaultService.hash('user@example.com');
   * ```
   */
  hash(data: string): string {
    const { createHash } = require('crypto');
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Generates a cryptographically secure random string.
   *
   * @param length - The length of the random string in bytes
   * @param encoding - The encoding to use (default: 'hex')
   * @returns Random string
   *
   * @example
   * ```typescript
   * const state = vaultService.generateRandom(32); // 64-char hex string
   * const codeVerifier = vaultService.generateRandom(32, 'base64url');
   * ```
   */
  generateRandom(length: number, encoding: 'hex' | 'base64url' = 'hex'): string {
    const bytes = randomBytes(length);

    if (encoding === 'base64url') {
      return bytes.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }

    return bytes.toString('hex');
  }

  /**
   * Derives a fixed-length encryption key from the environment variable.
   * Uses PBKDF2 for key derivation with 100,000 iterations.
   *
   * @param secret - The secret from environment variable
   * @returns 32-byte Buffer suitable for AES-256
   */
  private deriveKey(secret: string): Buffer {
    const { pbkdf2Sync } = require('crypto');

    // Use a fixed salt so the same input always produces the same key
    // This is acceptable because the input secret should already be random
    const salt = 'synapse-vault-salt-v1';

    return pbkdf2Sync(secret, salt, 100000, this.config.keyLength, 'sha256');
  }

  /**
   * Validates if a string appears to be properly encrypted data.
   *
   * @param data - The data to validate
   * @returns True if the data format matches our encryption output
   */
  isEncrypted(data: string): boolean {
    if (!data || typeof data !== 'string') {
      return false;
    }
    const parts = data.split('.');
    return parts.length === 3 && parts.every((part) => part.length > 0);
  }
}
