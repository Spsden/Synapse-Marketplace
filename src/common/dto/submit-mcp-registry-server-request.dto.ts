import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator';

const SERVER_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}$/;

export class SubmitMcpRegistryServerRequestDto {
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
