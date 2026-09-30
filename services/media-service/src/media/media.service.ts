import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import { StorageService } from '../storage/storage.service';
import {
  CreateUploadUrlDto,
  UploadUrlResponseDto,
} from './dto/create-upload-url.dto';
import { DeleteFileResponseDto } from './dto/delete-file.dto';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(private readonly storageService: StorageService) {}

  getInfo() {
    return {
      name: 'media-service',
      version: '0.0.1',
      description: 'Media management service',
      constraints: {
        maxFileSizeBytes: 5 * 1024 * 1024,
        maxFileSizeMB: 5,
        allowedMimeTypes: [
          'image/jpeg',
          'image/png',
          'image/webp',
          'image/gif',
          'application/pdf',
        ],
      },
    };
  }

  /**
   * Generates a pre-signed URL allowing direct client-to-storage file upload
   */
  async createUploadUrl(
    dto: CreateUploadUrlDto,
    userId?: string,
  ): Promise<UploadUrlResponseDto> {
    const ext = path.extname(dto.fileName).toLowerCase();
    const baseName = path
      .basename(dto.fileName, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    const sanitizedFileName = `${baseName}${ext}`;

    const uniqueId = uuidv4();
    const fileKey = `conversations/${dto.conversationId}/${uniqueId}-${sanitizedFileName}`;

    this.logger.log(
      `Generating pre-signed upload URL for [${fileKey}] by user [${userId || 'direct-client'}] (${dto.mimeType}, ${dto.fileSize} bytes)`,
    );

    return this.storageService.generatePresignedUploadUrl(
      fileKey,
      dto.mimeType,
      600, // 10 minutes expiry
    );
  }

  /**
   * Deletes a file from storage by its key
   */
  async deleteFile(
    fileKey: string,
    userId?: string,
  ): Promise<DeleteFileResponseDto> {
    if (!fileKey || !fileKey.startsWith('conversations/')) {
      throw new BadRequestException(
        'Invalid fileKey. Must start with conversations/',
      );
    }

    this.logger.log(
      `Deleting file [${fileKey}] requested by user [${userId || 'system'}]`,
    );
    await this.storageService.deleteObject(fileKey);

    return {
      success: true,
      message: `File deleted successfully`,
      fileKey,
    };
  }
}
