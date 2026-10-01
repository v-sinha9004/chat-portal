import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HealthModule } from './health/health.module';
import { SocketModule } from './socket/socket.module';
import { ChatQueueModule } from './queue/chat-queue.module';
import { MessagesModule } from './messages/messages.module';
import { PresenceModule } from './presence/presence.module';
import { ReadTrackingModule } from './read-tracking/read-tracking.module';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri:
          process.env.MONGODB_URI,
      }),
    }),
    HealthModule,
    ChatQueueModule,
    SocketModule,
    MessagesModule,
    PresenceModule,
    ReadTrackingModule,
  ],
})
export class AppModule { }
