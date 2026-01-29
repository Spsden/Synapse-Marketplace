import { ReviewDecision } from '../enums/version-status.enum';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Request DTO for admin review decisions.
 * Used to approve or reject plugin versions.
 */
export class ReviewDecisionRequestDto {
  @IsEnum(ReviewDecision, { message: 'Decision must be either PUBLISH or REJECT' })
  @IsNotEmpty({ message: 'Decision is required' })
  decision: ReviewDecision;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Rejection reason must not exceed 1000 characters' })
  rejectionReason?: string;

  @IsNotEmpty({ message: 'Reviewer ID is required' })
  @IsString()
  reviewedBy: string;
}
