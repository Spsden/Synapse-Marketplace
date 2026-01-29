import { HttpStatus } from '@nestjs/common';
import { PluginStoreException } from './plugin-store.exception';

/**
 * Exception thrown when no compatible version is found for the requested app version.
 */
export class InvalidVersionException extends PluginStoreException {
  constructor(message: string) {
    super(message, HttpStatus.NOT_FOUND);
  }
}
