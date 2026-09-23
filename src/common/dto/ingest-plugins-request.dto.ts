import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsOptional, IsString, Matches } from 'class-validator';

/**
 * Request body for `POST /admin/plugins/ingest`.
 *
 * Either `commitSha` (an immutable pin) or `ref` (a branch or tag resolved once
 * at request time) selects the source revision. Omitting both uses the
 * repository HEAD.
 */
export class IngestPluginsRequestDto {
  @ApiPropertyOptional({
    description: 'Exact 40-character commit SHA to build from. Takes precedence over ref.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9a-f]{40}$/, { message: 'commitSha must be a full 40-character hex SHA' })
  commitSha?: string;

  @ApiPropertyOptional({
    description: 'Branch, tag, or commit-ish to resolve. Defaults to HEAD.',
    example: 'main',
  })
  @IsOptional()
  @IsString()
  ref?: string;

  @ApiPropertyOptional({
    description: 'Restrict the run to these plugin folder names under the plugins directory.',
    type: [String],
    example: ['notion', 'spotify'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  plugins?: string[];

  @ApiPropertyOptional({
    description: 'Validate and build without writing to storage or the database.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}
