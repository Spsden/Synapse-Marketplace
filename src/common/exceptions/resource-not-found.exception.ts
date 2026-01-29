import { HttpStatus } from '@nestjs/common';
import { PluginStoreException } from './plugin-store.exception';

/**
 * Exception thrown when a requested resource is not found.
 */
export class ResourceNotFoundException extends PluginStoreException {
  constructor(resource: string, field: string, value: string) {
    super(
      `${resource} with ${field} '${value}' not found`,
      HttpStatus.NOT_FOUND,
    );
  }
}
