import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Param,
    Body,
    Headers,
    HttpCode,
    HttpStatus,
    BadRequestException,
    ForbiddenException,
    Logger,
    UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
    ApiTags,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiResponse,
} from "@nestjs/swagger";
import { OAuthClientsRepository } from "./oauth-clients.repository";
import { OAuthRedirectService } from "./oauth-redirect.service";
import { OAuthProvider } from "./oauth-provider.enum";
import { ResourceNotFoundException } from "../common/exceptions/resource-not-found.exception";

/**
 * OAuth Credentials Vault Controller
 *
 * Manages OAuth client credentials for plugins.
 * The Synapse host app fetches these credentials to run its own OAuth flow.
 */
@ApiTags("OAuth Credentials Vault")
@Controller("oauth/credentials")
export class OAuthCredentialsController {
    private readonly logger = new Logger(OAuthCredentialsController.name);

    constructor(
        private readonly oauthClientsRepository: OAuthClientsRepository,
        private readonly oauthRedirectService: OAuthRedirectService,
        private readonly configService: ConfigService,
    ) { }

    private parseBearerToken(authorization?: string): string | null {
        if (!authorization) return null;

        const [scheme, token] = authorization.split(" ");
        if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
            return null;
        }

        return token.trim();
    }

    private assertInternalRequestAuthorized(authorization?: string): void {
        const expectedToken =
            this.configService.get<string>("OAUTH_INTERNAL_SERVICE_TOKEN") ??
            this.configService.get<string>("SYNAPSE_MARKETPLACE_TOKEN");
        if (!expectedToken) {
            this.logger.error(
                "Neither OAUTH_INTERNAL_SERVICE_TOKEN nor SYNAPSE_MARKETPLACE_TOKEN is configured",
            );
            throw new UnauthorizedException(
                "Internal OAuth authorization is not configured",
            );
        }

        const providedToken = this.parseBearerToken(authorization);
        if (!providedToken || providedToken !== expectedToken) {
            throw new UnauthorizedException("Invalid internal authorization");
        }
    }

    private assertDeveloperRequestAuthorized(
        authorization: string | undefined,
        callerDeveloperId: string | undefined,
        expectedDeveloperId?: string,
    ): string {
        const expectedToken =
            this.configService.get<string>("OAUTH_DEVELOPER_API_TOKEN") ??
            this.configService.get<string>("SYNAPSE_MARKETPLACE_TOKEN");
        if (!expectedToken) {
            this.logger.error(
                "Neither OAUTH_DEVELOPER_API_TOKEN nor SYNAPSE_MARKETPLACE_TOKEN is configured",
            );
            throw new UnauthorizedException(
                "Developer OAuth authorization is not configured",
            );
        }

        const providedToken = this.parseBearerToken(authorization);
        if (!providedToken || providedToken !== expectedToken) {
            throw new UnauthorizedException("Invalid developer authorization");
        }

        if (!callerDeveloperId || callerDeveloperId.trim().length === 0) {
            throw new UnauthorizedException("Missing x-developer-id header");
        }

        if (
            expectedDeveloperId &&
            callerDeveloperId.trim() !== expectedDeveloperId.trim()
        ) {
            throw new ForbiddenException(
                "Developer is not authorized for this resource",
            );
        }

        return callerDeveloperId.trim();
    }

    /**
     * Submit OAuth credentials for a plugin.
     *
     * Developers submit their OAuth client credentials through this endpoint.
     * Secrets are encrypted before storage.
     */
    @ApiOperation({
        summary: "Submit OAuth credentials for a plugin",
        description: `Register OAuth client credentials (client_id, client_secret) for a plugin
                 to authenticate with a specific provider. Secrets are encrypted at rest.`,
    })
    @ApiResponse({
        status: 201,
        description: "OAuth credentials stored successfully",
    })
    @ApiResponse({ status: 400, description: "Invalid request" })
    @ApiResponse({
        status: 409,
        description: "Credentials already exist for this plugin/provider",
    })
    @Post()
    @HttpCode(HttpStatus.CREATED)
    async submitCredentials(
        @Headers("authorization") authorization: string | undefined,
        @Headers("x-developer-id") callerDeveloperId: string | undefined,
        @Body()
        body: {
            package_id: string;
            provider: OAuthProvider;
            client_id: string;
            client_secret: string;
            scopes?: string[];
            scope_mode?: "required" | "optional" | "forbidden";
            owner_developer_id: string;
            metadata?: Record<string, unknown>;
        },
    ) {
        if (!body.owner_developer_id) {
            throw new BadRequestException("owner_developer_id is required");
        }

        this.assertDeveloperRequestAuthorized(
            authorization,
            callerDeveloperId,
            body.owner_developer_id,
        );

        const result = await this.oauthClientsRepository.create({
            package_id: body.package_id,
            provider: body.provider,
            clientId: body.client_id,
            clientSecret: body.client_secret,
            scopes: body.scopes || [],
            scopeMode: body.scope_mode,
            createdBy: body.owner_developer_id,
            extras: body.metadata || {},
        });

        // Return without the secret
        return {
            id: result.id,
            package_id: result.package_id,
            provider: result.provider,
            client_id: result.clientId,
            scopes: result.scopes,
            scope_mode: result.scopeMode,
            metadata: result.extras || {},
            is_active: result.isActive,
            created_at: result.createdAt,
        };
    }

    // /**
    //  * List OAuth credentials by plugin.
    //  */
    // @ApiOperation({
    //     summary: "Get OAuth credentials for a plugin",
    //     description:
    //         "Retrieve all OAuth credentials for a specific plugin. Secrets are not returned.",
    // })
    // @ApiQuery({
    //     name: "plugin_id",
    //     description: "Plugin ID (UUID or package_id)",
    //     required: true,
    // })
    // @ApiResponse({
    //     status: 200,
    //     description: "Credentials retrieved successfully",
    // })
    // @Get()
    // async listByPlugin(@Query("package_id") pluginId: string) {
    //     const credentials =
    //         await this.oauthClientsRepository.findByPluginId(pluginId);
    //     return {
    //         credentials: credentials.map((cred) => ({
    //             id: cred.id,
    //             package_id: cred.package_id,
    //             provider: cred.provider,
    //             client_id: cred.clientId,
    //             scopes: cred.scopes,
    //             extras: cred.extras,
    //             is_active: cred.isActive,
    //             created_at: cred.createdAt,
    //             updated_at: cred.updatedAt,
    //         })),
    //     };
    // }

    /**
     * List OAuth credentials by developer.
     */
    @ApiOperation({
        summary: "Get OAuth credentials by developer",
        description: "Retrieve all OAuth credentials submitted by a developer.",
    })
    @Get("developer/:developerId")
    async listByDeveloper(
        @Headers("authorization") authorization: string | undefined,
        @Headers("x-developer-id") callerDeveloperId: string | undefined,
        @Param("developerId") developerId: string,
    ) {
        this.assertDeveloperRequestAuthorized(
            authorization,
            callerDeveloperId,
            developerId,
        );

        const credentials =
            await this.oauthClientsRepository.findByCreatedBy(developerId);
        return {
            credentials: credentials.map((cred) => ({
                id: cred.id,
                package_id: cred.package_id,
                provider: cred.provider,
                client_id: cred.clientId,
                scopes: cred.scopes,
                scope_mode: cred.scopeMode,
                extras: cred.extras,
                is_active: cred.isActive,
                created_at: cred.createdAt,
                updated_at: cred.updatedAt,
            })),
        };
    }

    /**
     * Fetch credentials for OAuth flow (internal endpoint).
     *
     * This endpoint is called by the Synapse host app to retrieve
     * decrypted credentials before initiating the OAuth flow.
     * Requires proper internal service authorization.
     */
    @ApiOperation({
        summary: "Fetch credentials for OAuth (internal)",
        description: `Retrieve decrypted OAuth credentials for initiating OAuth flow.
                 This endpoint should only be called by the Synapse host app with proper authorization.`,
    })
    @ApiQuery({ name: "package_id", description: "package_id", required: true })
    @ApiQuery({
        name: "provider",
        description: "OAuth provider",
        required: true,
    })
    @ApiResponse({
        status: 200,
        description: "Credentials retrieved successfully",
    })
    @ApiResponse({ status: 404, description: "Credentials not found" })
    @ApiResponse({ status: 410, description: "Credentials are disabled" })
    @Get(":package_id/:provider")
    async fetchForOAuth(
        @Headers("authorization") authorization: string | undefined,
        @Param("package_id") package_id: string,
        @Param("provider") provider: OAuthProvider,
    ) {
        this.assertInternalRequestAuthorized(authorization);

        const credentials = await this.oauthClientsRepository.getCredentials(
            package_id,
            provider as OAuthProvider,
        );

        if (!credentials) {
            throw new ResourceNotFoundException(
                "OAuth credentials",
                "package_id+provider",
                `${package_id}+${provider}`,
            );
        }

        return {
            client_id: credentials.clientId,
            client_secret: credentials.clientSecret,
            redirect_url: this.oauthRedirectService.getRedirectUrl(provider),
            scopes: credentials.scopes,
            scope_mode: credentials.scopeMode,
            metadata: credentials.metadata,
        };
    }

    /**
     * Update OAuth credentials.
     */
    @ApiOperation({
        summary: "Update OAuth credentials",
        description:
            "Update OAuth credentials. Only non-null fields are updated.",
    })
    @ApiParam({ name: "id", description: "Credential ID (UUID)" })
    @ApiResponse({
        status: 200,
        description: "Credentials updated successfully",
    })
    @Put(":id")
    async update(
        @Headers("authorization") authorization: string | undefined,
        @Headers("x-developer-id") callerDeveloperId: string | undefined,
        @Param("id") id: string,
        @Body()
        body: {
            client_id?: string;
            client_secret?: string;
            scopes?: string[];
            scope_mode?: "required" | "optional" | "forbidden";
            metadata?: Record<string, unknown>;
            is_active?: boolean;
        },
    ) {
        const developerId = this.assertDeveloperRequestAuthorized(
            authorization,
            callerDeveloperId,
        );

        const existing = await this.oauthClientsRepository.findById(id);
        if (!existing) {
            throw new ResourceNotFoundException("OAuth client", "id", id);
        }
        if (existing.createdBy !== developerId) {
            throw new ForbiddenException(
                "Developer is not authorized to update this credential",
            );
        }

        const updated = await this.oauthClientsRepository.update(id, {
            clientId: body.client_id,
            clientSecret: body.client_secret,
            scopes: body.scopes,
            scopeMode: body.scope_mode,
            isActive: body.is_active,
            extras: body.metadata,
        });

        return {
            id: updated.id,
            package_id: updated.package_id,
            provider: updated.provider,
            client_id: updated.clientId,
            scopes: updated.scopes,
            scope_mode: updated.scopeMode,
            extras: updated.extras,
            is_active: updated.isActive,
            updated_at: updated.updatedAt,
        };
    }

    /**
     * Disable OAuth credentials.
     */
    @ApiOperation({
        summary: "Disable OAuth credentials",
        description: "Soft-delete OAuth credentials (sets is_active = false).",
    })
    @ApiParam({ name: "id", description: "Credential ID (UUID)" })
    @ApiResponse({
        status: 204,
        description: "Credentials disabled successfully",
    })
    @Delete(":id")
    @HttpCode(HttpStatus.NO_CONTENT)
    async disable(
        @Headers("authorization") authorization: string | undefined,
        @Headers("x-developer-id") callerDeveloperId: string | undefined,
        @Param("id") id: string,
    ): Promise<void> {
        const developerId = this.assertDeveloperRequestAuthorized(
            authorization,
            callerDeveloperId,
        );

        const existing = await this.oauthClientsRepository.findById(id);
        if (!existing) {
            throw new ResourceNotFoundException("OAuth client", "id", id);
        }
        if (existing.createdBy !== developerId) {
            throw new ForbiddenException(
                "Developer is not authorized to disable this credential",
            );
        }

        await this.oauthClientsRepository.deactivate(id);
    }
}
