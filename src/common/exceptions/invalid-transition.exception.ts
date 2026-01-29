import { HttpStatus } from '@nestjs/common';
import { PluginStoreException } from './plugin-store.exception';

/**
 * Exception thrown when an invalid status transition is attempted.
 */
export class InvalidTransitionException extends PluginStoreException {
  constructor(message: string) {
    super(message, HttpStatus.BAD_REQUEST);
  }
}
