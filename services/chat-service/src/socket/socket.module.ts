import { Module } from '@nestjs/common';
import { SocketGateway } from './socket.gateway';
import { SocketService } from './socket.service';
import { ChatQueueModule } from '../queue/chat-queue.module';
import { PresenceModule } from '../presence/presence.module';

@Module({
  imports: [ChatQueueModule, PresenceModule],
  providers: [SocketGateway, SocketService],
  exports: [SocketService],
})
export class SocketModule {}

