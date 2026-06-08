import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { McpRegistryReviewDecision } from '../enums/mcp-registry-submission-status.enum';

export class ReviewMcpRegistrySubmissionRequestDto {
  @ApiProperty({ enum: McpRegistryReviewDecision })
  @IsEnum(McpRegistryReviewDecision, {
    message: 'Decision must be either PUBLISH or REJECT',
  })
  @IsNotEmpty()
  decision: McpRegistryReviewDecision;

  @ApiProperty({
    example: 'admin@synapse.dev',
    description: 'Admin or automation identity performing the review.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  reviewedBy: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reviewNotes?: string;
}
