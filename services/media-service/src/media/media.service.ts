import { Injectable } from '@nestjs/common';

@Injectable()
export class MediaService {
  getInfo() {
    return {
      name: 'media-service',
      version: '0.0.1',
      description: 'Media management service',
    };
  }
}
