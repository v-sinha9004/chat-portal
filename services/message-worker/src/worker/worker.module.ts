import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MessageWorkerProcessor } from './message-worker.processor';
import { ReadWorkerProcessor } from './read-worker.processor';
import { MessagesModule } from '../messages/messages.module';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'chat-persistence' },
      { name: 'read-persistence' },
    ),
    MessagesModule,
  ],
  providers: [MessageWorkerProcessor, ReadWorkerProcessor],
})
export class WorkerModule {}

