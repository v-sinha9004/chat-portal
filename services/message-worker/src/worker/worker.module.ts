import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MessageWorkerProcessor } from './message-worker.processor';
import { MessagesModule } from '../messages/messages.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'chat-persistence',
    }),
    MessagesModule,
  ],
  providers: [MessageWorkerProcessor],
})
export class WorkerModule {}
