import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ChatQueueProducer } from './chat-queue.producer';

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
        },
      }),
    }),
    BullModule.registerQueue({
      name: 'chat-persistence',
    }),
  ],
  providers: [ChatQueueProducer],
  exports: [ChatQueueProducer, BullModule],
})
export class ChatQueueModule {}
