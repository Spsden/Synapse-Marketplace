import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Query,
    Param,
    Body,
    HttpCode,
    HttpStatus,
} from "@nestjs/common";
import {
    ApiTags,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiResponse,
} from "@nestjs/swagger";
import { OAuthClientsRepository } from "./oauth-clients.repository";
import { VaultService } from "../vault/vault.service";
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
    constructor(
        private readonly oauthClientsRepository: OAuthClientsRepository,
        private readonly vaultService: VaultService,
    ) { }

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
        @Body()
        body: {
            package_id: string;
            provider: OAuthProvider;
            client_id: string;
            client_secret: string;
            scopes?: string[];
            owner_developer_id: string;
            metadata?: Record<string, unknown>;
        },
    ) {
        const result = await this.oauthClientsRepository.create({
            package_id: body.package_id,
            provider: body.provider,
            clientId: body.client_id,
            clientSecret: body.client_secret,
            scopes: body.scopes || [],
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
            metadata: body.metadata || {},
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
    async listByDeveloper(@Param("developerId") developerId: string) {
        const credentials =
            await this.oauthClientsRepository.findByCreatedBy(developerId);
        return {
            credentials: credentials.map((cred) => ({
                id: cred.id,
                package_id: cred.package_id,
                provider: cred.provider,
                client_id: cred.clientId,
                scopes: cred.scopes,
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
        @Param("package_id") package_id: string,
        @Param("provider") provider: OAuthProvider,
    ) {
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
            redirect_url: credentials.redirectUrl,
            scopes: credentials.scopes,
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
        @Param("id") id: string,
        @Body()
        body: {
            client_id?: string;
            client_secret?: string;
            scopes?: string[];
            metadata?: Record<string, unknown>;
            is_active?: boolean;
        },
    ) {
        const updated = await this.oauthClientsRepository.update(id, {
            clientId: body.client_id,
            clientSecret: body.client_secret,
            scopes: body.scopes,
            isActive: body.is_active,
            extras: body.metadata,
        });

        return {
            id: updated.id,
            package_id: updated.package_id,
            provider: updated.provider,
            client_id: updated.clientId,
            scopes: updated.scopes,
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
    async disable(@Param("id") id: string): Promise<void> {
        await this.oauthClientsRepository.deactivate(id);
    }
}
