import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * Key to store metadata in request for public routes.
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Decorator to mark a route as public (bypasses authentication).
 */
export const Public = () => {
  return (target: object, propertyKey: string, descriptor: PropertyDescriptor) => {
    const metaInfo = Reflect.getMetadata(IS_PUBLIC_KEY, descriptor) || {
      value: false,
    };
    Reflect.defineMetadata(IS_PUBLIC_KEY, { value: true }, descriptor);
  };
};

/**
 * Guard to check if a route is marked as public.
 */
@Injectable()
export class PublicGuard implements CanActivate {
  private readonly logger = new Logger(PublicGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    this.logger.debug(`Route ${context.getClass().name}.${context.getHandler().name} is protected`);
    return false;
  }
}
