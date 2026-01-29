import { HttpStatus } from '@nestjs/common';
import { PluginStoreException } from './plugin-store.exception';

/**
 * Exception thrown when attempting to create a version that already exists.
 */
export class VersionConflictException extends PluginStoreException {
  constructor(packageId: string, version: string) {
    super(
      `Version ${version} already exists for plugin ${packageId}. Please increment your version number.`,
      HttpStatus.CONFLICT,
    );
  }
}
