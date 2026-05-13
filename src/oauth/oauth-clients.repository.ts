import {
    Injectable,
    Logger,
    Inject,
    ForbiddenException,
    BadRequestException,
    ConflictException,
} from "@nestjs/common";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { ConfigService } from "@nestjs/config";
import { OAuthProvider, isProviderSupported } from "./oauth-provider.enum";
import { VaultService } from "../vault/vault.service";
import { ResourceNotFoundException } from "../common/exceptions/resource-not-found.exception";

export type ScopeMode = "required" | "optional" | "forbidden";

/**
 * Platform-defined maximum allowed scopes per OAuth provider.
 * These limits prevent privilege escalation and ensure compliance with provider policies.
 */
const PROVIDER_MAX_SCOPES: Record<OAuthProvider, string[]> = {
    [OAuthProvider.NOTION]: ["read", "write", "email"],
    [OAuthProvider.GOOGLE]: [
        "openid",
        "email",
        "profile",
        "drive.readonly",
        "calendar.readonly",
        "contacts.readonly",
    ],
    [OAuthProvider.GITHUB]: ["read:user", "user:email", "repo", "read:org"],
    [OAuthProvider.SLACK]: ["channels:read", "chat:write", "files:read"],
    [OAuthProvider.MICROSOFT]: ["openid", "email", "profile", "files.read"],
    [OAuthProvider.DISCORD]: ["identify", "email", "guilds"],
    [OAuthProvider.LINEAR]: ["read", "write", "issues:read"],
    [OAuthProvider.FIGMA]: ["file_read", "comments"],
    [OAuthProvider.SALESFORCE]: ["api", "refresh_token", "full"],
    [OAuthProvider.DROPBOX]: ["files.metadata.read", "files.content.read"],
    [OAuthProvider.STRIPE]: ["read_write"],
};

/**
 * Validate that requested scopes are within platform-defined limits.
 */
function validateScopes(
    provider: OAuthProvider,
    requestedScopes: string[],
): void {
    const maxScopes = PROVIDER_MAX_SCOPES[provider];

    if (!maxScopes) {
        throw new BadRequestException(
            `No scope limits defined for provider: ${provider}`,
        );
    }

    const invalidScopes = requestedScopes.filter(
        (scope) => !maxScopes.includes(scope),
    );

    if (invalidScopes.length > 0) {
        throw new ForbiddenException(
            `Requested scopes not allowed for ${provider}: ${invalidScopes.join(", ")}. ` +
            `Allowed scopes: ${maxScopes.join(", ")}`,
        );
    }
}

/**
 * OAuth client entity.
 */
interface OAuthClient {
    id: string;
    package_id: string;
    provider: OAuthProvider;
    clientId: string;
    clientSecretEncrypted: string;
    scopes: string[];
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
    isActive: boolean;
    extras?: Record<string, unknown>;
    scopeMode: ScopeMode;
}

/**
 * DTO for creating OAuth client credentials.
 */
interface CreateOAuthClientDto {
    package_id: string;
    provider: OAuthProvider;
    clientId: string;
    clientSecret: string;
    scopes: string[];
    createdBy: string;
    extras?: Record<string, unknown>;
    scopeMode?: ScopeMode;
}

/**
 * DTO for updating OAuth client credentials.
 */
interface UpdateOAuthClientDto {
    clientId?: string;
    clientSecret?: string;
    scopes?: string[];
    isActive?: boolean;
    extras?: Record<string, unknown>;
    scopeMode?: ScopeMode;
}

/**
 * Repository for OAuthClient entity using Supabase.
 * Manages OAuth client credentials for plugins.
 */
@Injectable()
export class OAuthClientsRepository {
    private readonly logger = new Logger(OAuthClientsRepository.name);
    private readonly supabase: SupabaseClient;

    constructor(
        @Inject(ConfigService) private configService: ConfigService,
        private vaultService: VaultService,
    ) {
        const supabaseConfig = this.configService.get("supabase");
        this.supabase = createClient(
            supabaseConfig.projectUrl,
            supabaseConfig.serviceRoleKey,
            {
                auth: { persistSession: false },
            },
        );
    }

    private defaultScopeMode(provider: OAuthProvider): ScopeMode {
        // Notion can rely on integration-level capabilities without explicit scope param.
        if (provider === OAuthProvider.NOTION) return "optional";
        return "required";
    }

    private normalizeScopeMode(
        mode: unknown,
        provider: OAuthProvider,
    ): ScopeMode {
        if (
            mode === "required" ||
            mode === "optional" ||
            mode === "forbidden"
        ) {
            return mode;
        }
        return this.defaultScopeMode(provider);
    }

    private extractScopeModeFromExtras(
        extras: Record<string, unknown> | undefined,
        provider: OAuthProvider,
    ): ScopeMode {
        return this.normalizeScopeMode(extras?.scope_mode, provider);
    }

    private applyScopeModePolicy(
        provider: OAuthProvider,
        scopeMode: ScopeMode,
        scopes: string[],
    ): string[] {
        if (scopeMode === "forbidden") {
            if (scopes.length > 0) {
                throw new BadRequestException(
                    `Provider ${provider} is configured with scope_mode=forbidden, but scopes were supplied.`,
                );
            }
            return [];
        }

        if (scopeMode === "required" && scopes.length === 0) {
            throw new BadRequestException(
                `Provider ${provider} requires scopes but none were supplied.`,
            );
        }

        if (scopes.length > 0) {
            validateScopes(provider, scopes);
        }

        return scopes;
    }

    /**
     * Find OAuth client credentials by plugin ID and provider.
     */
    async findByPluginAndProvider(
        package_id: string,
        provider: OAuthProvider,
    ): Promise<OAuthClient | null> {
        const { data, error } = await this.supabase
            .from("plugin_oauth_clients")
            .select("*")
            .eq("package_id", package_id)
            .eq("provider", provider)
            .eq("is_active", true)
            .single();

        if (error || !data) {
            return null;
        }

        return this.mapToEntity(data);
    }

    /**
     * Find all OAuth clients for a specific plugin.
     */
    async findByPluginId(pluginId: string): Promise<OAuthClient[]> {
        const { data } = await this.supabase
            .from("plugin_oauth_clients")
            .select("*")
            .eq("plugin_id", pluginId)
            .order("created_at", { ascending: false });

        return (data || []).map((item) => this.mapToEntity(item));
    }

    /**
     * Find OAuth clients by package_id.
     */
    async findByPackageId(packageId: string): Promise<OAuthClient[]> {
        // First get the plugin_id from package_id
        const { data: plugin } = await this.supabase
            .from("plugins")
            .select("id")
            .eq("package_id", packageId)
            .single();

        if (!plugin) {
            return [];
        }

        return this.findByPluginId(plugin.id);
    }

    /**
     * Find all OAuth clients created by a specific developer.
     */
    async findByCreatedBy(createdBy: string): Promise<OAuthClient[]> {
        const { data } = await this.supabase
            .from("plugin_oauth_clients")
            .select("*")
            .eq("owner_developer_id", createdBy)
            .order("created_at", { ascending: false });

        return (data || []).map((item) => this.mapToEntity(item));
    }

    /**
     * Find all active OAuth clients for a specific provider.
     */
    async findByProvider(provider: OAuthProvider): Promise<OAuthClient[]> {
        const { data } = await this.supabase
            .from("plugin_oauth_clients")
            .select("*")
            .eq("provider", provider)
            .eq("is_active", true)
            .order("created_at", { ascending: false });

        return (data || []).map((item) => this.mapToEntity(item));
    }

    /**
     * Find OAuth client by ID.
     */
    async findById(id: string): Promise<OAuthClient | null> {
        const { data, error } = await this.supabase
            .from("plugin_oauth_clients")
            .select("*")
            .eq("id", id)
            .single();

        if (error || !data) {
            return null;
        }

        return this.mapToEntity(data);
    }

    /**
     * Create new OAuth client credentials (encrypts the client secret).
     *
     * Security validations performed:
     * 1. Provider must be supported at platform level
     * 2. Scopes must be within platform-defined limits
     * 3. Only ONE active client per plugin+provider (deactivates existing)
     */
    async create(dto: CreateOAuthClientDto): Promise<OAuthClient> {
        // 1️⃣ Validate provider is supported at platform level
        if (!isProviderSupported(dto.provider)) {
            throw new ForbiddenException(
                `OAuth provider '${dto.provider}' is not supported. ` +
                `Supported providers: ${Object.values(OAuthProvider).join(", ")}`,
            );
        }

        const scopeMode = this.normalizeScopeMode(dto.scopeMode, dto.provider);
        const normalizedExtras: Record<string, unknown> = {
            ...(dto.extras || {}),
            scope_mode: scopeMode,
        };
        const effectiveScopes = this.applyScopeModePolicy(
            dto.provider,
            scopeMode,
            dto.scopes ?? [],
        );

        // Encrypt the client secret before storing
        const clientSecretEncrypted = await this.vaultService.encrypt(
            dto.clientSecret,
        );

        const newClient = {
            package_id: dto.package_id,
            provider: dto.provider,
            client_id: dto.clientId,
            client_secret_encrypted: clientSecretEncrypted,
            scopes: effectiveScopes,
            owner_developer_id: dto.createdBy,
            metadata: normalizedExtras,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_active: true,
        };

        const { data, error } = await this.supabase
            .from("plugin_oauth_clients")
            .upsert(newClient, { onConflict: "package_id,provider" })
            .select()
            .single();

        if (error) {
            if (
                error.code === "23505" ||
                error.message?.includes("unique constraint")
            ) {
                throw new ConflictException(
                    `OAuth credentials already exist for ${dto.package_id}/${dto.provider}. ` +
                    "Use update if you intend to modify existing credentials.",
                );
            }
            throw new Error(`Failed to create OAuth client: ${error.message}`);
        }

        return this.mapToEntity(data);
    }

    /**
     * Compute the platform-owned redirect URL for a provider.
     * Redirect URLs are platform-controlled and not configurable by developers.
     */
    // getRedirectUrl(provider: OAuthProvider): string {
    //     const baseUrl =
    //         this.configService.get<string>("app.baseUrl") ||
    //         `curl -v "https://synapsemarketplace-let8q0bnv-bentennison223-4156s-projects.vercel.app`;
    //     return `${baseUrl}/api/v1/oauth/callback/${provider}`;
    // }

    /**
     * Update existing OAuth client credentials.
     */
    async update(id: string, dto: UpdateOAuthClientDto): Promise<OAuthClient> {
        const existing = await this.findById(id);
        if (!existing) {
            throw new ResourceNotFoundException("OAuth client", "id", id);
        }

        const updateData: any = {
            updated_at: new Date().toISOString(),
        };

        if (dto.clientId !== undefined) updateData.client_id = dto.clientId;
        if (dto.isActive !== undefined) updateData.is_active = dto.isActive;

        const mergedExtras: Record<string, unknown> = {
            ...(existing.extras || {}),
            ...(dto.extras || {}),
        };
        if (dto.scopeMode !== undefined) {
            mergedExtras.scope_mode = dto.scopeMode;
        }
        const scopeMode = this.extractScopeModeFromExtras(
            mergedExtras,
            existing.provider,
        );
        mergedExtras.scope_mode = scopeMode;

        const modeChanged = scopeMode !== existing.scopeMode;
        const candidateScopes = dto.scopes ?? existing.scopes;
        const effectiveScopes = this.applyScopeModePolicy(
            existing.provider,
            scopeMode,
            candidateScopes,
        );

        if (dto.scopes !== undefined || modeChanged) {
            updateData.scopes = effectiveScopes;
        }

        if (dto.extras !== undefined || dto.scopeMode !== undefined) {
            updateData.metadata = mergedExtras;
        }

        // Encrypt new client secret if provided
        if (dto.clientSecret !== undefined) {
            updateData.client_secret_encrypted =
                await this.vaultService.encrypt(dto.clientSecret);
        }

        const { data, error } = await this.supabase
            .from("plugin_oauth_clients")
            .update(updateData)
            .eq("id", id)
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to update OAuth client: ${error.message}`);
        }

        return this.mapToEntity(data);
    }

    /**
     * Deactivate OAuth client credentials (soft delete).
     */
    async deactivate(id: string): Promise<OAuthClient> {
        return this.update(id, { isActive: false });
    }

    /**
     * Delete OAuth client credentials permanently.
     */
    async delete(id: string): Promise<void> {
        const { error } = await this.supabase
            .from("plugin_oauth_clients")
            .delete()
            .eq("id", id);

        if (error) {
            throw new Error(`Failed to delete OAuth client: ${error.message}`);
        }
    }

    /**
     * Get both client ID and decrypted secret for a plugin/provider combination.
     * Returns null if credentials don't exist or are inactive.
     * This is the ONLY method that should return decrypted secrets for OAuth flows.
     */
    async getCredentials(
        package_id: string,
        provider: OAuthProvider,
    ): Promise<{
        clientId: string;
        clientSecret: string;
        redirectUrl: string;
        scopes: string[];
        scopeMode: ScopeMode;
        metadata?: Record<string, unknown>;
    } | null> {

        const client = await this.findByPluginAndProvider(package_id, provider);

        if (!client) {
            return null;
        }

        const clientSecret = await this.vaultService.decrypt(
            client.clientSecretEncrypted,
        );


        return {
            clientId: client.clientId,
            clientSecret,
            // redirectUrl: this.getRedirectUrl(provider),
            redirectUrl: "",
            scopes: client.scopes,
            scopeMode: client.scopeMode,
            metadata: client.extras,
        };
    }

    /**
     * Map database row to OAuthClient entity.
     */
    private mapToEntity(data: any): OAuthClient {
        const extras = (data.metadata || {}) as Record<string, unknown>;
        const provider = data.provider as OAuthProvider;
        const scopeMode = this.extractScopeModeFromExtras(extras, provider);

        return {
            id: data.id,
            package_id: data.package_id,
            provider,
            clientId: data.client_id,
            clientSecretEncrypted: data.client_secret_encrypted,
            scopes: data.scopes,
            createdBy: data.owner_developer_id,
            createdAt: new Date(data.created_at),
            updatedAt: new Date(data.updated_at),
            isActive: data.is_active,
            extras,
            scopeMode,
        };
    }
}

import * as crypto from "crypto";
