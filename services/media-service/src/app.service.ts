import { Injectable } from '@nestjs/common';
import { StorageService } from './storage/storage.service';

@Injectable()
export class AppService {
  constructor(private readonly storageService: StorageService) {}

  getHello(): string {
    return 'Media Service is running!';
  }

  async getHealth() {
    const isStorageConnected = await this.storageService.checkHealth();

    return {
      status: isStorageConnected ? 'ok' : 'degraded',
      service: 'media-service',
      storage: isStorageConnected ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    };
  }
}
