import { Injectable, Logger } from '@nestjs/common';
import AdmZip from 'adm-zip';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { readFileSync } from 'fs';

/**
 * Manifest validation DTO.
 */
class ManifestDto {
  name!: string;
  version!: string;
  description?: string;
  author?: string;
  minAppVersion?: string;
}

/**
 * Result of extracting a .synx package.
 */
export interface SynxPackage {
  manifest: Record<string, any>;
  jsCode: string;
  iconData?: Buffer;
  iconName?: string;
  readme?: string;
}

/**
 * Service for extracting and validating .synx plugin packages.
 *
 * .synx Format (ZIP archive):
 * - manifest.json (Required): Metadata, permissions, configuration
 * - plugin.js (Required): The JavaScript code
 * - icon.png (Optional): 128x128px icon
 * - README.md (Optional): Documentation
 */
@Injectable()
export class SynxPackageService {
  private readonly logger = new Logger(SynxPackageService.name);

  /**
   * Extracts and validates a .synx package.
   *
   * @param buffer The .synx file buffer
   * @returns Extracted package contents
   * @throws Error if file is invalid or required files are missing
   */
  async extractPackage(buffer: Buffer): Promise<SynxPackage> {
    // Validate ZIP format
    let zip: AdmZip | null = null;
    try {
      zip = new AdmZip(buffer);
    } catch (error) {
      throw new Error('File must be a valid ZIP archive');
    }

    const entries = zip.getEntries();
    const result: Partial<SynxPackage> = {
      manifest: {},
      jsCode: '',
    };

    let foundManifest = false;
    let foundPluginJs = false;

    for (const entry of entries) {
      const name = entry.entryName;

      // Skip directories
      if (entry.isDirectory) {
        continue;
      }

      // Security: Check for zip slip vulnerability
      if (name.includes('..') || name.startsWith('/')) {
        throw new Error(`Invalid file path in archive: ${name}`);
      }

      this.logger.debug(`Processing entry: ${name}`);

      switch (name) {
        case 'manifest.json':
          result.manifest = this.extractManifest(entry.getData());
          foundManifest = true;
          this.logger.debug('Extracted manifest.json');
          break;

        case 'plugin.js':
          result.jsCode = entry.getData().toString('utf-8');
          foundPluginJs = true;
          this.logger.debug(`Extracted plugin.js (${result.jsCode.length} bytes)`);
          break;

        case 'icon.png':
        case 'icon.jpg':
        case 'icon.jpeg':
        case 'icon.svg':
          result.iconData = entry.getData();
          result.iconName = name;
          this.logger.debug(`Extracted ${name}`);
          break;

        case 'README.md':
          result.readme = entry.getData().toString('utf-8');
          this.logger.debug('Extracted README.md');
          break;

        default:
          // Optional files like LICENSE, assets/, lib/ - log and skip
          this.logger.debug(`Skipping optional file: ${name}`);
          break;
      }
    }

    // Validate required files
    if (!foundManifest) {
      throw new Error("Required file 'manifest.json' not found in .synx package");
    }
    if (!foundPluginJs) {
      throw new Error("Required file 'plugin.js' not found in .synx package");
    }

    return result as SynxPackage;
  }

  /**
   * Extracts and validates manifest.json from the ZIP entry.
   */
  private extractManifest(buffer: Buffer): Record<string, any> {
    try {
      const manifestJson = buffer.toString('utf-8');
      const manifest = JSON.parse(manifestJson);

      // Basic validation - check required fields exist
      if (!manifest.name) {
        throw new Error("manifest.json missing required field: 'name'");
      }
      if (!manifest.version) {
        throw new Error("manifest.json missing required field: 'version'");
      }

      return manifest;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error('manifest.json is not valid JSON');
      }
      throw error;
    }
  }

  /**
   * Extracts and validates a .synx package from a file path.
   *
   * @param filePath Path to the .synx file
   * @returns Extracted package contents
   */
  extractPackageFromFile(filePath: string): SynxPackage {
    try {
      const buffer = readFileSync(filePath);
      // This is a synchronous wrapper - ideally should be async
      return this.extractPackage(buffer) as unknown as SynxPackage;
    } catch (error) {
      this.logger.error(`Failed to extract .synx package from file: ${error.message}`);
      throw error;
    }
  }
}
