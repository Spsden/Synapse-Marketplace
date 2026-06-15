import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { Request } from 'express';

abstract class MarketplaceTokenGuard implements CanActivate {
  protected abstract tokenEnvironmentNames: string[];

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.headers.authorization;
    const presented = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length).trim()
      : '';
    const configured = this.tokenEnvironmentNames
      .map((name) => process.env[name])
      .filter((value): value is string => Boolean(value));

    if (
      !presented ||
      configured.length === 0 ||
      !configured.some((token) => secureEqual(token, presented))
    ) {
      throw new UnauthorizedException('A valid Marketplace API token is required.');
    }
    return true;
  }
}

@Injectable()
export class MarketplaceAdminGuard extends MarketplaceTokenGuard {
  protected tokenEnvironmentNames = [
    'SYNAPSE_MARKETPLACE_TOKEN',
    'OAUTH_INTERNAL_SERVICE_TOKEN',
  ];
}

@Injectable()
export class MarketplaceDeveloperGuard extends MarketplaceTokenGuard {
  protected tokenEnvironmentNames = [
    'SYNAPSE_MARKETPLACE_TOKEN',
    'OAUTH_DEVELOPER_API_TOKEN',
  ];
}

function secureEqual(expected: string, presented: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const presentedBuffer = Buffer.from(presented);
  return (
    expectedBuffer.length === presentedBuffer.length &&
    timingSafeEqual(expectedBuffer, presentedBuffer)
  );
}
