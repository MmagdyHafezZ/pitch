import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class PresignUploadDto {
  @IsString()
  @IsNotEmpty()
  bucket: string;

  @IsString()
  @IsNotEmpty()
  key: string;

  @IsString()
  @IsOptional()
  contentType?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  expiresInSeconds?: number;
}

export class PresignDownloadDto {
  @IsString()
  @IsNotEmpty()
  bucket: string;

  @IsString()
  @IsNotEmpty()
  key: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  expiresInSeconds?: number;
}

export class PresignDeleteDto {
  @IsString()
  @IsNotEmpty()
  bucket: string;

  @IsString()
  @IsNotEmpty()
  key: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  expiresInSeconds?: number;
}

export class ListFilesDto {
  @IsString()
  @IsNotEmpty()
  bucket: string;

  @IsString()
  @IsOptional()
  prefix?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number;
}

export class DeletePrefixDto {
  @IsString()
  @IsNotEmpty()
  bucket: string;

  @IsString()
  @IsNotEmpty()
  prefix: string;
}
