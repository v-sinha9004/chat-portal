import { Controller, Get } from '@nestjs/common';
import { MediaService } from './media.service';

@Controller()
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get('info')
  getInfo() {
    return this.mediaService.getInfo();
  }
}
