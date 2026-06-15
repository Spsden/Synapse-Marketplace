export interface PluginResponse {
  id: string;
  packageId: string;
  name: string;
  description: string | null;
  author: string;
  iconKey: string | null;
  status: PluginStatus;
  latestVersionId: string | null;
  category: string | null;
  tags: string | null;
  sourceUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PluginDetailResponse {
  id: string;
  packageId: string;
  name: string;
  description: string | null;
  author: string;
  iconKey: string | null;
  status: PluginStatus;
  category: string | null;
  tags: string | null;
  sourceUrl: string | null;
  pluginCreatedAt: string;
  versionId: string;
  version: string;
  manifest: Record<string, unknown>;
  minAppVersion: string;
  releaseNotes: string | null;
  versionCreatedAt: string;
  downloadCount: number;
  downloadUrl: string | null;
  expiresAt: number | null;
  fileSizeBytes: number | null;
  checksumSha256: string | null;
  storageBucket: string | null;
  storagePath: string | null;
}

export interface PluginVersionResponse {
  id: string;
  pluginId: string;
  version: string;
  manifest: Record<string, unknown>;
  minAppVersion: string;
  releaseNotes: string | null;
  status: VersionStatus;
  rejectionReason: string | null;
  reviewedBy: string | null;
  createdAt: string;
  reviewedAt: string | null;
  publishedAt: string | null;
  downloadCount: number;
  isFlagged: boolean;
  storagePath: string | null;
  storageBucket: string | null;
  fileSizeBytes: number | null;
  checksumSha256: string | null;
}

export interface PluginStatisticsResponse {
  packageId: string;
  name: string;
  status: PluginStatus;
  totalVersions: number;
  publishedVersions: number;
  totalDownloads: number;
  createdAt: string;
  updatedAt: string;
}

export interface PluginReviewItem {
  id: string;
  pluginId: string;
  packageId: string;
  name: string;
  description: string;
  version: string;
  author: string;
  createdAt: string;
  status: VersionStatus;
  isFlagged: boolean;
  flagReason: string | null;
}

export interface ReviewDecisionRequest {
  decision: "PUBLISH" | "REJECT";
  rejectionReason?: string;
  reviewedBy: string;
}

export interface McpRegistryEntry {
  schemaVersion: number;
  id: string;
  serverId: string;
  displayName: string;
  description?: string | null;
  currentVersion: string;
  maintainerName: string;
  maintainerKind: string;
  trustLevel: string;
  documentationUrl?: string | null;
  source: Record<string, unknown>;
  auth?: Record<string, unknown> | null;
  tools: string[];
  runtimeTargets: string[];
  platforms: string[];
  desktop?: Record<string, unknown> | null;
  cloud?: Record<string, unknown> | null;
  capabilities?: Record<string, unknown> | null;
  upstream?: Record<string, unknown> | null;
  upstreamHash?: string | null;
  authProfiles: Record<string, unknown>[];
  artifacts: Record<string, unknown>[];
  deployments: Record<string, unknown>[];
  capabilityCatalog: Record<string, unknown>;
  cloudCertification?: Record<string, unknown> | null;
  publishedAt: string;
}

export interface McpRegistrySnapshot {
  version: string;
  updatedAt: string;
  servers: McpRegistryEntry[];
}

export interface McpRegistryReviewItem {
  id: string;
  serverId: string;
  targetEntryId?: string | null;
  changeType: "NEW" | "UPDATE";
  displayName: string;
  currentVersion: string;
  maintainerName: string;
  createdBy: string;
  createdAt: string;
  status: "SUBMITTED" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";
}

export interface SubmitMcpServerRequest {
  serverId: string;
  displayName: string;
  description?: string;
  currentVersion: string;
  maintainerName: string;
  maintainerKind: "official" | "community" | "synapse";
  trustLevel: "official" | "community-reviewed" | "synapse-managed";
  documentationUrl?: string;
  source: Record<string, unknown>;
  auth?: Record<string, unknown>;
  tools: string[];
  runtimeTargets: string[];
  platforms: string[];
  desktop?: Record<string, unknown>;
  cloud?: Record<string, unknown>;
  capabilities?: Record<string, unknown>;
  submissionNotes?: string;
  createdBy: string;
}

export interface ImportOfficialMcpServerRequest {
  server: Record<string, unknown>;
  overlay: Record<string, unknown>;
}

export interface ReviewMcpSubmissionRequest {
  decision: "PUBLISH" | "REJECT";
  reviewedBy: string;
  reviewNotes?: string;
}

export type PluginStatus =
  | "SUBMITTED"
  | "PENDING_REVIEW"
  | "PUBLISHED"
  | "REJECTED"
  | "DELETED";

export type VersionStatus =
  | "SUBMITTED"
  | "PENDING_REVIEW"
  | "PUBLISHED"
  | "REJECTED"
  | "FLAGGED";

export type OAuthProvider =
  | "notion"
  | "google"
  | "github"
  | "slack"
  | "microsoft"
  | "discord"
  | "linear"
  | "figma"
  | "salesforce"
  | "dropbox"
  | "stripe";

export type ScopeMode = "required" | "optional" | "forbidden";

export interface OAuthCredentialResponse {
  id: string;
  package_id: string;
  provider: OAuthProvider;
  client_id: string;
  scopes: string[];
  scope_mode?: ScopeMode;
  metadata?: Record<string, unknown>;
  extras?: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface OAuthCredentialsListResponse {
  credentials: OAuthCredentialResponse[];
}

export interface SubmitOAuthCredentialRequest {
  package_id: string;
  provider: OAuthProvider;
  client_id: string;
  client_secret: string;
  scopes?: string[];
  scope_mode?: ScopeMode;
  owner_developer_id: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateOAuthCredentialRequest {
  client_id?: string;
  client_secret?: string;
  scopes?: string[];
  scope_mode?: ScopeMode;
  metadata?: Record<string, unknown>;
  is_active?: boolean;
}
