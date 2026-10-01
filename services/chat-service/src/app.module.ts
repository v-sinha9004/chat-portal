import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HealthModule } from './health/health.module';
import { RedisModule } from './redis/redis.module';
import { SocketModule } from './socket/socket.module';
import { ChatQueueModule } from './queue/chat-queue.module';
import { MessagesModule } from './messages/messages.module';
import { PresenceModule } from './presence/presence.module';
import { ReadTrackingModule } from './read-tracking/read-tracking.module';
import { ClientsModule } from './clients/clients.module';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri:
          process.env.MONGODB_URI,
      }),
    }),
    HealthModule,
    RedisModule,
    ChatQueueModule,
    SocketModule,
    MessagesModule,
    PresenceModule,
    ReadTrackingModule,
    ClientsModule,
  ],
})
export class AppModule { }
