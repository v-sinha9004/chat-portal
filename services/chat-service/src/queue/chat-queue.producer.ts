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
  conversationId: string;
  clientMessageId?: string;
  senderId: string;
  recipientId?: string;
  groupId?: string;
  content: string;
  timestamp: string;
  isAnnouncement?: boolean;
  heading?: string;
  replyTo?: {
    messageId: string;
    senderId: string;
    text: string;
  };
}

@Injectable()
export class ChatQueueProducer {
  private readonly logger = new Logger(ChatQueueProducer.name);

  constructor(
    @InjectQueue('chat-persistence') private readonly chatQueue: Queue,
    @InjectQueue('read-persistence') private readonly readQueue: Queue,
  ) {}

  async enqueueDirectMessage(event: NewMessageEvent<{ message: string }>) {
    const jobData: ChatPersistenceJobData = {
      type: 'direct',
      messageId: event.id,
      conversationId: event.conversationId,
      clientMessageId: event.clientMessageId,
      senderId: event.senderId,
      recipientId: event.recipientId,
      content: event.data?.message || '',
      timestamp: event.timestamp,
      replyTo: event.replyTo,
    };

    const jobId = event.clientMessageId || event.id;
    this.logger.log(`Enqueueing direct message job [${jobId}] for recipient: ${event.recipientId}`);

    return this.chatQueue.add('persist-message', jobData, {
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
      conversationId: event.conversationId,
      clientMessageId: event.clientMessageId,
      senderId: event.senderId,
      groupId: event.groupId,
      content: event.data?.message || '',
      timestamp: event.timestamp,
      isAnnouncement: event.isAnnouncement,
      heading: event.heading,
      replyTo: event.replyTo,
    };

    const jobId = event.clientMessageId || event.id;
    this.logger.log(`Enqueueing group message job [${jobId}] for group: ${event.groupId}`);

    return this.chatQueue.add('persist-message', jobData, {
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

  async enqueuePersistLastRead(data: {
    userId: string;
    conversationId: string;
    lastReadMessageId: string;
  }) {
    const jobData = {
      userId: data.userId,
      conversationId: data.conversationId,
      lastReadMessageId: data.lastReadMessageId,
      lastReadAt: new Date().toISOString(),
    };

    this.logger.log(
      `Enqueueing persist-lastread job for user ${data.userId} in convo ${data.conversationId}`,
    );

    return this.readQueue.add('persist-lastread', jobData, {
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
