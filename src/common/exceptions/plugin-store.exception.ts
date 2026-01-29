import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Base exception for all plugin store errors.
 */
export class PluginStoreException extends HttpException {
  constructor(message: string, statusCode: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR) {
    super(message, statusCode);
  }
}
