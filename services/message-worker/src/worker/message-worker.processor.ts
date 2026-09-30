import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MessagesService, SaveMessageDto } from '../messages/messages.service';

@Processor('chat-persistence', { concurrency: 10 })
export class MessageWorkerProcessor extends WorkerHost {
  private readonly logger = new Logger(MessageWorkerProcessor.name);

  constructor(private readonly messagesService: MessagesService) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    if (job.name === 'persist-lastread') {
      this.logger.log(
        `Processing persist-lastread job [${job.id}] for user [${job.data?.userId}] in convo [${job.data?.conversationId}]`,
      );
      const result = await this.messagesService.saveLastRead(job.data);
      return { success: true, conversationId: result.conversationId };
    }

    this.logger.log(
      `Processing persistence job [${job.id}] for message [${job.data?.messageId}] (type: ${job.data?.type})`,
    );

    const result = await this.messagesService.saveMessage(job.data);
    return { success: true, messageId: result.messageId };
  }
}
