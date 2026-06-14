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
} from 'class-validator';

const SERVER_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}$/;

export class SubmitMcpRegistryServerRequestDto {
  @ApiPropertyOptional({
    example: 2,
    description: 'Synapse MCP catalog schema version. Omitted legacy submissions use version 1.',
  })
  @IsOptional()
  @IsInt()
  @IsIn([1, 2])
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
    example: ['notion-get-self', 'notion-create-pages'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsString({ each: true })
  tools: string[];

  @ApiProperty({
    type: [String],
    example: ['desktop-node', 'cloud-worker'],
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
    description: 'Desktop execution details such as install strategy and entrypoint.',
  })
  @IsOptional()
  @IsObject()
  desktop?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Cloud runtime metadata for Worker/hosted execution.',
  })
  @IsOptional()
  @IsObject()
  cloud?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Extra capability metadata such as OS permissions or app dependencies.',
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
  @IsObject({ each: true })
  authProfiles?: Record<string, unknown>[];

  @ApiPropertyOptional({
    description: 'Immutable reviewed artifacts built from npm, GitHub, OCI, or Synapse sources.',
    type: [Object],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsObject({ each: true })
  artifacts?: Record<string, unknown>[];

  @ApiPropertyOptional({
    description: 'Platform-specific execution variants for this logical MCP server.',
    type: [Object],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsObject({ each: true })
  deployments?: Record<string, unknown>[];

  @ApiPropertyOptional({
    description: 'Approved tools and future MCP resources, prompts, tasks, and app capabilities.',
  })
  @IsOptional()
  @IsObject()
  capabilityCatalog?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Cloud Node certification evidence and policy.',
  })
  @IsOptional()
  @IsObject()
  cloudCertification?: Record<string, unknown>;

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
