import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class DeleteFileDto {
  @IsString()
  @IsNotEmpty({ message: 'fileKey is required' })
  @Matches(/^conversations\/[\w\-./]+$/, {
    message: 'Invalid fileKey format. Must start with conversations/',
  })
  fileKey: string;
}

export class DeleteFileQueryDto extends DeleteFileDto {}

export class DeleteFileResponseDto {
  success: boolean;
  message: string;
  fileKey: string;
}
