import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  McpRegistryChangeType,
  McpRegistrySubmissionStatus,
} from '../enums/mcp-registry-submission-status.enum';

export class McpRegistryReviewItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  serverId: string;

  @ApiPropertyOptional()
  targetEntryId?: string | null;

  @ApiProperty({ enum: McpRegistryChangeType })
  changeType: McpRegistryChangeType;

  @ApiProperty()
  displayName: string;

  @ApiProperty()
  currentVersion: string;

  @ApiProperty()
  maintainerName: string;

  @ApiProperty()
  createdBy: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ enum: McpRegistrySubmissionStatus })
  status: McpRegistrySubmissionStatus;

  constructor(data: McpRegistryReviewItemDto) {
    Object.assign(this, data);
  }
}
