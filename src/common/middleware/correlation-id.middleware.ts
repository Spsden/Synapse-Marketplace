import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Extension to Express Request to include correlation ID.
 */
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}

/**
 * Middleware to add correlation ID to all requests for tracing.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CorrelationIdMiddleware.name);

  private readonly HEADER_NAME = 'x-correlation-id';

  use(req: Request, res: Response, next: NextFunction): void {
    const correlationId =
      req.headers[this.HEADER_NAME] || crypto.randomUUID();

    req.correlationId = correlationId as string;
    res.setHeader(this.HEADER_NAME, correlationId);

    this.logger.debug(`Processing request ${req.method} ${req.url} - Correlation ID: ${correlationId}`);

    next();
  }
}
