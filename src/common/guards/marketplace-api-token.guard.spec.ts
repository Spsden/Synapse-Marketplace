import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import {
  MarketplaceAdminGuard,
  MarketplaceDeveloperGuard,
} from './marketplace-api-token.guard';

function context(authorization?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: { authorization },
      }),
    }),
  } as ExecutionContext;
}

describe('Marketplace API token guards', () => {
  const originalEnvironment = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnvironment,
      SYNAPSE_MARKETPLACE_TOKEN: 'marketplace-secret',
      OAUTH_DEVELOPER_API_TOKEN: 'developer-secret',
      OAUTH_INTERNAL_SERVICE_TOKEN: 'internal-secret',
    };
  });

  afterAll(() => {
    process.env = originalEnvironment;
  });

  it('accepts configured admin and developer bearer tokens', () => {
    expect(
      new MarketplaceAdminGuard().canActivate(
        context('Bearer internal-secret'),
      ),
    ).toBe(true);
    expect(
      new MarketplaceDeveloperGuard().canActivate(
        context('Bearer developer-secret'),
      ),
    ).toBe(true);
  });

  it('fails closed for missing, invalid, or unconfigured tokens', () => {
    expect(() =>
      new MarketplaceAdminGuard().canActivate(context()),
    ).toThrow(UnauthorizedException);
    expect(() =>
      new MarketplaceAdminGuard().canActivate(context('Bearer wrong')),
    ).toThrow(UnauthorizedException);

    delete process.env.SYNAPSE_MARKETPLACE_TOKEN;
    delete process.env.OAUTH_INTERNAL_SERVICE_TOKEN;
    expect(() =>
      new MarketplaceAdminGuard().canActivate(
        context('Bearer internal-secret'),
      ),
    ).toThrow(UnauthorizedException);
  });
});
