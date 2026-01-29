import { HttpStatus } from '@nestjs/common';
import { PluginStoreException } from './plugin-store.exception';

/**
 * Exception thrown when a request times out.
 */
export class RequestTimeoutException extends PluginStoreException {
  constructor(operation: string) {
    super(
      `Request timed out during ${operation}. Please try again with a smaller file.`,
      HttpStatus.REQUEST_TIMEOUT,
    );
  }
}
