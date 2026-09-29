import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  NewMessageEvent,
  GroupMessageEvent,
} from '../socket/interfaces/socket-events.interface';

export interface ChatPersistenceJobData {
  type: 'direct' | 'group';
  messageId: string;
  clientMessageId?: string;
  senderId: string;
  recipientId?: string;
  groupId?: string;
  content: string;
  timestamp: string;
}

@Injectable()
export class ChatQueueProducer {
  private readonly logger = new Logger(ChatQueueProducer.name);

  constructor(
    @InjectQueue('chat-persistence') private readonly queue: Queue,
  ) {}

  async enqueueDirectMessage(event: NewMessageEvent<{ message: string }>) {
    const jobData: ChatPersistenceJobData = {
      type: 'direct',
      messageId: event.id,
      clientMessageId: event.clientMessageId,
      senderId: event.senderId,
      recipientId: event.recipientId,
      content: event.data?.message || '',
      timestamp: event.timestamp,
    };

    const jobId = event.clientMessageId || event.id;
    this.logger.log(`Enqueueing direct message job [${jobId}] for recipient: ${event.recipientId}`);

    return this.queue.add('persist-message', jobData, {
      jobId,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: true,
      removeOnFail: 1000,
    });
  }

  async enqueueGroupMessage(event: GroupMessageEvent<{ message: string }>) {
    const jobData: ChatPersistenceJobData = {
      type: 'group',
      messageId: event.id,
      clientMessageId: event.clientMessageId,
      senderId: event.senderId,
      groupId: event.groupId,
      content: event.data?.message || '',
      timestamp: event.timestamp,
    };

    const jobId = event.clientMessageId || event.id;
    this.logger.log(`Enqueueing group message job [${jobId}] for group: ${event.groupId}`);

    return this.queue.add('persist-message', jobData, {
      jobId,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: true,
      removeOnFail: 1000,
    });
  }
}
