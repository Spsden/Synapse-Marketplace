import {
    Controller,
    Get,
    Query,
    Param,
    Res,
    HttpCode,
    HttpStatus,
    BadRequestException,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiResponse,
} from '@nestjs/swagger';
import { Response } from 'express';
import { Logger } from '@nestjs/common';
import { isProviderSupported } from './oauth-provider.enum';

/**
 * OAuth Callback Controller
 *
 * Handles OAuth provider callbacks and redirects to the Synapse app.
 * This is a stateless passthrough - no tokens are stored.
 */
@ApiTags('OAuth Callback')
@Controller('oauth/callback')
export class OAuthCallbackController {
    private readonly logger = new Logger(OAuthCallbackController.name);

    constructor() {}

    /**
     * OAuth callback endpoint for all providers.
     *
     * Receives the OAuth callback from the provider and redirects
     * to the Synapse app's deep link scheme.
     */
    @ApiOperation({
        summary: 'OAuth callback handler',
        description:
            'Receives OAuth callback from provider and redirects to Synapse app deep link.',
    })
    @ApiParam({
        name: 'provider',
        description: 'OAuth provider name',
        example: 'google',
    })
    @ApiQuery({ name: 'code', description: 'OAuth authorization code', required: false })
    @ApiQuery({ name: 'state', description: 'OAuth state parameter', required: false })
    @ApiQuery({ name: 'error', description: 'OAuth error code', required: false })
    @ApiQuery({
        name: 'error_description',
        description: 'OAuth error description',
        required: false,
    })
    @ApiResponse({ status: 200, description: 'Redirected to Synapse app' })
    @ApiResponse({ status: 400, description: 'Bad Request - missing code' })
    @Get(':provider')
    @HttpCode(HttpStatus.OK)
    async handleCallback(
        @Param('provider') provider: string,
        @Query('code') code: string,
        @Query('state') state: string,
        @Query('error') error: string,
        @Query('error_description') errorDescription: string,
        @Res() res: Response,
    ): Promise<void> {
        // Validate provider
        if (!isProviderSupported(provider)) {
            this.logger.warn(`Invalid provider received: ${provider}`);
            throw new BadRequestException(`Invalid provider: ${provider}`);
        }

        // Log the callback
        this.logger.log(
            `OAuth callback received - provider: ${provider}, ` +
                `state: ${state || 'none'}, ` +
                `code present: ${!!code}, ` +
                `error: ${error || 'none'}`,
        );

        // Build the deep link URL
        const deepLinkBase = `synapse://oauth/${provider}`;

        // Handle error case
        if (error) {
            const errorUrl = new URL(deepLinkBase);
            errorUrl.searchParams.set('error', error);
            if (errorDescription) {
                errorUrl.searchParams.set('error_description', errorDescription);
            }
            this.logger.error(
                `OAuth error for ${provider}: ${error} - ${errorDescription || 'no description'}`,
            );
            return res.redirect(errorUrl.toString());
        }

        // Handle missing code without error
        if (!code) {
            this.logger.warn(`OAuth callback for ${provider} missing code parameter`);
            throw new BadRequestException('Missing authorization code');
        }

        // Success case - redirect with code and state
        const successUrl = new URL(deepLinkBase);
        successUrl.searchParams.set('code', code);
        if (state) {
            successUrl.searchParams.set('state', state);
        }

        this.logger.log(`Redirecting to Synapse app for ${provider} OAuth completion`);
        return res.redirect(successUrl.toString());
    }
}
