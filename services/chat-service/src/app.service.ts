import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Chat Service is running!';
  }

  getHealth() {
    return {
      status: 'ok',
      service: 'chat-service',
      timestamp: new Date().toISOString(),
    };
  }
}
