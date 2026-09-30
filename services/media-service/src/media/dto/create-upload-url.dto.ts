import {
  IsString,
  IsNotEmpty,
  IsIn,
  IsInt,
  Min,
  Max,
  Matches,
} from 'class-validator';

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

// Max file size: 5 MB (5 * 1024 * 1024 bytes)
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export class CreateUploadUrlDto {
  @IsString()
  @IsNotEmpty({ message: 'conversationId is required' })
  conversationId: string;

  @IsString()
  @IsNotEmpty({ message: 'fileName is required' })
  @Matches(/^[\w\-. ]+$/, {
    message: 'fileName contains invalid characters',
  })
  fileName: string;

  @IsString()
  @IsIn(ALLOWED_MIME_TYPES, {
    message: `mimeType must be one of: ${ALLOWED_MIME_TYPES.join(', ')}`,
  })
  mimeType: AllowedMimeType;

  @IsInt()
  @Min(1, { message: 'fileSize must be greater than 0 bytes' })
  @Max(MAX_FILE_SIZE_BYTES, {
    message: `fileSize cannot exceed 5 MB (${MAX_FILE_SIZE_BYTES} bytes)`,
  })
  fileSize: number;
}

export class UploadUrlResponseDto {
  uploadUrl: string;
  publicUrl: string;
  fileKey: string;
  expiresInSeconds: number;
}
