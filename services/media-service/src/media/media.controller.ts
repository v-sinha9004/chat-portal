import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { MediaService } from './media.service';
import {
  CreateUploadUrlDto,
  UploadUrlResponseDto,
} from './dto/create-upload-url.dto';
import {
  DeleteFileDto,
  DeleteFileQueryDto,
  DeleteFileResponseDto,
} from './dto/delete-file.dto';

@Controller()
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get('info')
  getInfo() {
    return this.mediaService.getInfo();
  }

  @Post('upload-url')
  @HttpCode(HttpStatus.OK)
  async createUploadUrl(
    @Body() dto: CreateUploadUrlDto,
    @Headers('x-user-id') userId?: string,
  ): Promise<UploadUrlResponseDto> {
    return this.mediaService.createUploadUrl(dto, userId);
  }

  @Delete('file')
  @HttpCode(HttpStatus.OK)
  async deleteFile(
    @Query() query: DeleteFileQueryDto,
    @Headers('x-user-id') userId?: string,
  ): Promise<DeleteFileResponseDto> {
    return this.mediaService.deleteFile(query.fileKey, userId);
  }

  @Post('delete')
  @HttpCode(HttpStatus.OK)
  async deleteFileByBody(
    @Body() body: DeleteFileDto,
    @Headers('x-user-id') userId?: string,
  ): Promise<DeleteFileResponseDto> {
    return this.mediaService.deleteFile(body.fileKey, userId);
  }
}
