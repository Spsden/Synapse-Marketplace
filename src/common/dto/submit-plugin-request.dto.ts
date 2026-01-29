import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Request DTO for submitting a new plugin version.
 * Used by developers to upload or update their plugins.
 */
export class SubmitPluginRequestDto {
  @IsNotEmpty({ message: 'Package ID is required' })
  @Matches(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/, {
    message: 'Package ID must be in reverse domain notation (e.g., com.example.plugin)',
  })
  packageId: string;

  @IsNotEmpty({ message: 'Plugin name is required' })
  @Length(3, 100, { message: 'Plugin name must be between 3 and 100 characters' })
  name: string;

  @IsNotEmpty({ message: 'Description is required' })
  @MaxLength(1000, { message: 'Description must not exceed 1000 characters' })
  description: string;

  @IsNotEmpty({ message: 'Author is required' })
  @MaxLength(100, { message: 'Author name must not exceed 100 characters' })
  author: string;

  @IsOptional()
  @MaxLength(500, { message: 'Icon key must not exceed 500 characters' })
  iconKey?: string;

  @IsOptional()
  @MaxLength(50, { message: 'Category must not exceed 50 characters' })
  category?: string;

  @IsOptional()
  @MaxLength(500, { message: 'Tags must not exceed 500 characters' })
  tags?: string;

  @IsOptional()
  @MaxLength(500, { message: 'Source URL must not exceed 500 characters' })
  sourceUrl?: string;

  @IsNotEmpty({ message: 'Version is required' })
  @Matches(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/,
    { message: 'Version must follow semantic versioning (e.g., 1.0.0, 2.1.3)' },
  )
  version: string;

  @IsNotEmpty({ message: 'JavaScript code is required' })
  @Length(1, 500000, { message: 'JavaScript code must not exceed 500KB' })
  jsCode: string;

  @IsNotEmpty({ message: 'Minimum app version is required' })
  @Matches(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/, {
    message: 'Minimum app version must follow semantic versioning (e.g., 1.0.0)',
  })
  minAppVersion: string;

  @IsObject({ message: 'Manifest must be a valid object' })
  manifest: Record<string, any>;

  @IsOptional()
  @MaxLength(2000, { message: 'Release notes must not exceed 2000 characters' })
  releaseNotes?: string;

  @IsOptional()
  @IsString()
  storagePath?: string;

  @IsOptional()
  @IsString()
  storageBucket?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  fileSizeBytes?: number;

  @IsOptional()
  @IsString()
  @Length(64, 64)
  checksumSha256?: string;

  @IsOptional()
  @IsString()
  tempStoragePath?: string;
}
