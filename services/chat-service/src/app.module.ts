import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SocketModule } from './socket/socket.module';
import { ChatQueueModule } from './queue/chat-queue.module';
import { MessagesModule } from './messages/messages.module';
import { PresenceModule } from './presence/presence.module';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri:
          process.env.MONGODB_URI ||
          'mongodb://admin:password@localhost:27017/chat_portal?authSource=admin',
      }),
    }),
    ChatQueueModule,
    SocketModule,
    MessagesModule,
    PresenceModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
