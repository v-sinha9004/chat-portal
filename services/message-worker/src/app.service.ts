import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Message Worker is running!';
  }

  getHealth() {
    return {
      status: 'ok',
      service: 'message-worker',
      timestamp: new Date().toISOString(),
    };
  }
}
