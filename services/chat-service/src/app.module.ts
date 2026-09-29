import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SocketModule } from './socket/socket.module';
import { ChatQueueModule } from './queue/chat-queue.module';

@Module({
  imports: [ChatQueueModule, SocketModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

