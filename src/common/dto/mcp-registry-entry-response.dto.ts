import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class McpRegistryEntryResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  serverId: string;

  @ApiProperty()
  displayName: string;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiProperty()
  currentVersion: string;

  @ApiProperty()
  maintainerName: string;

  @ApiProperty()
  maintainerKind: string;

  @ApiProperty()
  trustLevel: string;

  @ApiPropertyOptional()
  documentationUrl?: string | null;

  @ApiProperty({ type: Object })
  source: Record<string, unknown>;

  @ApiPropertyOptional({ type: Object })
  auth?: Record<string, unknown> | null;

  @ApiProperty({ type: [String] })
  tools: string[];

  @ApiProperty({ type: [String] })
  runtimeTargets: string[];

  @ApiProperty({ type: [String] })
  platforms: string[];

  @ApiPropertyOptional({ type: Object })
  desktop?: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: Object })
  cloud?: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: Object })
  capabilities?: Record<string, unknown> | null;

  @ApiProperty()
  publishedAt: Date;

  constructor(data: McpRegistryEntryResponseDto) {
    Object.assign(this, data);
  }
}

export class McpRegistrySnapshotResponseDto {
  @ApiProperty({ example: '1' })
  version: string;

  @ApiProperty()
  updatedAt: string;

  @ApiProperty({ type: [McpRegistryEntryResponseDto] })
  servers: McpRegistryEntryResponseDto[];

  constructor(data: McpRegistrySnapshotResponseDto) {
    Object.assign(this, data);
  }
}
