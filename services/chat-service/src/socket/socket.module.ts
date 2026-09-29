import { Module } from '@nestjs/common';
import { SocketGateway } from './socket.gateway';
import { SocketService } from './socket.service';
import { ChatQueueModule } from '../queue/chat-queue.module';

@Module({
  imports: [ChatQueueModule],
  providers: [SocketGateway, SocketService],
  exports: [SocketService],
})
export class SocketModule {}

