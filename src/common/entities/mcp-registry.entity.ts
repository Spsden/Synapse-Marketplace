import {
  McpRegistryChangeType,
  McpRegistrySubmissionStatus,
} from '../enums/mcp-registry-submission-status.enum';

type JsonObject = Record<string, unknown>;

export interface McpRegistryDefinition {
  serverId: string;
  displayName: string;
  description?: string | null;
  currentVersion: string;
  maintainerName: string;
  maintainerKind: string;
  trustLevel: string;
  documentationUrl?: string | null;
  source: JsonObject;
  auth?: JsonObject | null;
  tools: string[];
  runtimeTargets: string[];
  platforms: string[];
  desktop?: JsonObject | null;
  cloud?: JsonObject | null;
  capabilities?: JsonObject | null;
  schemaVersion: number;
  upstream?: JsonObject | null;
  upstreamHash?: string | null;
  authProfiles: JsonObject[];
  artifacts: JsonObject[];
  deployments: JsonObject[];
  capabilityCatalog: JsonObject;
  cloudCertification?: JsonObject | null;
}

type DefaultedDefinitionFields =
  | 'schemaVersion'
  | 'authProfiles'
  | 'artifacts'
  | 'deployments'
  | 'capabilityCatalog';

export type CreateMcpRegistryDefinitionDto = Omit<
  McpRegistryDefinition,
  DefaultedDefinitionFields
> &
  Partial<Pick<McpRegistryDefinition, DefaultedDefinitionFields>>;

export interface McpRegistryEntry extends McpRegistryDefinition {
  id: string;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date;
}

export type CreateMcpRegistryEntryDto = CreateMcpRegistryDefinitionDto & {
  createdBy?: string | null;
  updatedBy?: string | null;
  publishedAt?: Date;
};

export type UpdateMcpRegistryEntryDto = Partial<CreateMcpRegistryEntryDto>;

export interface McpRegistrySubmission extends McpRegistryDefinition {
  id: string;
  targetEntryId?: string | null;
  changeType: McpRegistryChangeType;
  submissionNotes?: string | null;
  createdBy: string;
  status: McpRegistrySubmissionStatus;
  reviewedBy?: string | null;
  reviewNotes?: string | null;
  createdAt: Date;
  updatedAt: Date;
  reviewedAt?: Date | null;
}

export type CreateMcpRegistrySubmissionDto = CreateMcpRegistryDefinitionDto & {
  targetEntryId?: string | null;
  changeType: McpRegistryChangeType;
  submissionNotes?: string | null;
  createdBy: string;
};

export interface UpdateMcpRegistrySubmissionDto {
  targetEntryId?: string | null;
  status?: McpRegistrySubmissionStatus;
  reviewedBy?: string | null;
  reviewNotes?: string | null;
  reviewedAt?: Date | null;
}
