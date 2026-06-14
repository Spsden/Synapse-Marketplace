import {
  McpRegistryChangeType,
  McpRegistrySubmissionStatus,
} from '../enums/mcp-registry-submission-status.enum';

export interface McpRegistryEntry {
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
  schemaVersion: number;
  upstream?: Record<string, unknown> | null;
  upstreamHash?: string | null;
  authProfiles: Record<string, unknown>[];
  artifacts: Record<string, unknown>[];
  deployments: Record<string, unknown>[];
  capabilityCatalog: Record<string, unknown>;
  cloudCertification?: Record<string, unknown> | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date;
}

export interface CreateMcpRegistryEntryDto {
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
  schemaVersion?: number;
  upstream?: Record<string, unknown> | null;
  upstreamHash?: string | null;
  authProfiles?: Record<string, unknown>[];
  artifacts?: Record<string, unknown>[];
  deployments?: Record<string, unknown>[];
  capabilityCatalog?: Record<string, unknown>;
  cloudCertification?: Record<string, unknown> | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  publishedAt?: Date;
}

export interface UpdateMcpRegistryEntryDto
  extends Partial<CreateMcpRegistryEntryDto> {}

export interface McpRegistrySubmission {
  id: string;
  serverId: string;
  targetEntryId?: string | null;
  changeType: McpRegistryChangeType;
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
  schemaVersion: number;
  upstream?: Record<string, unknown> | null;
  upstreamHash?: string | null;
  authProfiles: Record<string, unknown>[];
  artifacts: Record<string, unknown>[];
  deployments: Record<string, unknown>[];
  capabilityCatalog: Record<string, unknown>;
  cloudCertification?: Record<string, unknown> | null;
  submissionNotes?: string | null;
  createdBy: string;
  status: McpRegistrySubmissionStatus;
  reviewedBy?: string | null;
  reviewNotes?: string | null;
  createdAt: Date;
  updatedAt: Date;
  reviewedAt?: Date | null;
}

export interface CreateMcpRegistrySubmissionDto {
  serverId: string;
  targetEntryId?: string | null;
  changeType: McpRegistryChangeType;
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
  schemaVersion?: number;
  upstream?: Record<string, unknown> | null;
  upstreamHash?: string | null;
  authProfiles?: Record<string, unknown>[];
  artifacts?: Record<string, unknown>[];
  deployments?: Record<string, unknown>[];
  capabilityCatalog?: Record<string, unknown>;
  cloudCertification?: Record<string, unknown> | null;
  submissionNotes?: string | null;
  createdBy: string;
}

export interface UpdateMcpRegistrySubmissionDto {
  targetEntryId?: string | null;
  status?: McpRegistrySubmissionStatus;
  reviewedBy?: string | null;
  reviewNotes?: string | null;
  reviewedAt?: Date | null;
}
