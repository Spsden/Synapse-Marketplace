import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsInt,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const SERVER_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}$/;

export class McpAuthProfileRequestDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsIn(['oauth2-user', 'api-key', 'mcp-oauth', 'none'])
  type: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  @IsIn(['authorization-header', 'mcp-protocol'])
  delivery?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

/**
 * A deployment of a hosted MCP server.
 *
 * Synapse supports provider-hosted remote servers only, so every deployment is
 * an HTTPS remote reached by the runtime over Streamable HTTP (SSE retained as a
 * compatibility transport). There is no local execution: no npm artifacts, no
 * stdio entrypoints, no Synapse-hosted Node workers.
 */
export class McpDeploymentRequestDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsIn(['remote-http'])
  kind: string;

  @IsString()
  @IsIn(['provider-remote'])
  runtimeTarget: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  platforms: string[];

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsString()
  authProfileId?: string;

  @IsOptional()
  @IsString()
  @IsIn(['streamable-http', 'sse'])
  transport?: string;

  @IsUrl({ require_protocol: true, protocols: ['https'] })
  url: string;

  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;
}

export class SubmitMcpRegistryServerRequestDto {
  @ApiPropertyOptional({
    example: 2,
    description:
      'Synapse MCP catalog schema version. Only version 2 is accepted; ' +
      'legacy version 1 described locally executed servers, which Synapse no longer supports.',
  })
  @IsOptional()
  @IsInt()
  @IsIn([2])
  schemaVersion?: number;

  @ApiProperty({
    example: 'notion',
    description: 'Stable runtime registry identifier used by plugins.',
  })
  @IsString()
  @Matches(SERVER_ID_PATTERN, {
    message:
      'serverId must be lowercase kebab-case and 2-63 characters long.',
  })
  serverId: string;

  @ApiProperty({ example: 'Notion MCP' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  displayName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @ApiProperty({ example: '1.0.0' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  currentVersion: string;

  @ApiProperty({ example: 'Notion' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  maintainerName: string;

  @ApiProperty({ example: 'official', enum: ['official', 'community', 'synapse'] })
  @IsString()
  @IsIn(['official', 'community', 'synapse'])
  maintainerKind: string;

  @ApiProperty({
    example: 'official',
    enum: ['official', 'community-reviewed', 'synapse-managed'],
  })
  @IsString()
  @IsIn(['official', 'community-reviewed', 'synapse-managed'])
  trustLevel: string;

  @ApiPropertyOptional({ example: 'https://developers.notion.com/docs/get-started-with-mcp' })
  @IsOptional()
  @IsUrl()
  documentationUrl?: string;

  @ApiProperty({
    description: 'Source metadata used for review and provenance.',
    example: { type: 'remote-http', url: 'https://mcp.notion.com/mcp' },
  })
  @IsObject()
  source: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Authentication metadata consumed by Synapse runtimes.',
    example: { type: 'oauth2-user', provider: 'notion' },
  })
  @IsOptional()
  @IsObject()
  auth?: Record<string, unknown>;

  @ApiProperty({
    type: [String],
    example: ['notion-create-pages'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsString({ each: true })
  tools: string[];

  @ApiProperty({
    type: [String],
    example: ['provider-remote'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  runtimeTargets: string[];

  @ApiProperty({
    type: [String],
    example: ['macos', 'windows', 'linux', 'android', 'ios'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  platforms: string[];

  @ApiPropertyOptional({
    description: 'Extra capability metadata such as app dependencies.',
  })
  @IsOptional()
  @IsObject()
  capabilities?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Original official MCP registry document or other upstream provenance.',
  })
  @IsOptional()
  @IsObject()
  upstream?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'SHA-256 digest of the canonical upstream document.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^sha256-[a-f0-9]{64}$/)
  upstreamHash?: string;

  @ApiPropertyOptional({
    description: 'Named authentication profiles referenced by deployments.',
    type: [Object],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => McpAuthProfileRequestDto)
  authProfiles?: McpAuthProfileRequestDto[];

  @ApiPropertyOptional({
    description: 'Platform-specific execution variants for this logical MCP server.',
    type: [Object],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => McpDeploymentRequestDto)
  deployments?: McpDeploymentRequestDto[];

  @ApiPropertyOptional({
    description: 'Approved tools and future MCP resources, prompts, tasks, and app capabilities.',
  })
  @IsOptional()
  @IsObject()
  capabilityCatalog?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  submissionNotes?: string;

  @ApiProperty({
    example: 'developer@example.com',
    description: 'Developer or system identity making the submission.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  createdBy: string;
}
