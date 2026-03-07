import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

/**
 * Service for determining OAuth redirect URLs based on provider requirements.
 *
 * Some providers (like Notion and Slack) require HTTPS callback URLs,
 * while others can use the Synapse deep link scheme directly.
 */
@Injectable()
export class OAuthRedirectService {
    private readonly logger = new Logger(OAuthRedirectService.name);

    // Providers that require HTTPS callbacks
    private readonly HTTPS_ONLY_PROVIDERS = ['notion', 'slack'];

    constructor(private readonly configService: ConfigService) {}

    /**
     * Get the redirect URL for a provider's OAuth flow.
     *
     * @param provider - The OAuth provider name
     * @returns The appropriate redirect URL (HTTPS or deep link)
     * @throws Error if SERVER_URL is not configured for HTTPS-only providers
     */
    getRedirectUrl(provider: string): string {
        if (this.HTTPS_ONLY_PROVIDERS.includes(provider)) {
            const serverUrl = this.configService.get<string>('SERVER_URL');
            if (!serverUrl) {
                this.logger.error(`SERVER_URL not configured for provider: ${provider}`);
                throw new Error(
                    'SERVER_URL configuration is required for HTTPS-only providers',
                );
            }
            return `${serverUrl}/oauth/callback/${provider}`;
        }
        return `synapse://oauth/${provider}`;
    }

    /**
     * Check if a provider requires HTTPS callback URLs.
     *
     * @param provider - The OAuth provider name
     * @returns true if the provider requires HTTPS, false otherwise
     */
    requiresHttps(provider: string): boolean {
        return this.HTTPS_ONLY_PROVIDERS.includes(provider);
    }
}
