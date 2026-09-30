import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { MediaService } from './media.service';
import {
  CreateUploadUrlDto,
  UploadUrlResponseDto,
} from './dto/create-upload-url.dto';

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
  ): Promise<UploadUrlResponseDto> {
    return this.mediaService.createUploadUrl(dto);
  }
}
