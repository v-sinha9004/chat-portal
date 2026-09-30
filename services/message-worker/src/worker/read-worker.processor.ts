import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MessagesService, SaveLastReadDto } from '../messages/messages.service';

@Processor('read-persistence', { concurrency: 10 })
export class ReadWorkerProcessor extends WorkerHost {
  private readonly logger = new Logger(ReadWorkerProcessor.name);

  constructor(private readonly messagesService: MessagesService) {
    super();
  }

  async process(job: Job<SaveLastReadDto>): Promise<any> {
    this.logger.log(
      `Processing persist-lastread job [${job.id}] for user [${job.data?.userId}] in convo [${job.data?.conversationId}]`,
    );

    const result = await this.messagesService.saveLastRead(job.data);
    return { success: true, conversationId: result.conversationId };
  }
}
