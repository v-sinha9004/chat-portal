import {
  Injectable,
  Logger,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message, MessageDocument } from '../schemas/message.schema';
import { SocketService } from '../../socket/socket.service';
import { ReadTrackingService } from '../../read-tracking/read-tracking.service';
import {
  getDirectConversationId,
  getGroupConversationId,
} from '../../socket/interfaces/socket-events.interface';
import {
  QueryMessagesDto,
  QueryMessageContextDto,
} from '../dto';
import {
  ConversationHistoryResponse,
  ChatMessageResponse,
  MessageContextResponse,
} from '../interfaces';
import {
  sanitizeLimit,
  formatMessageResponse,
} from '../utils/message-format.util';

@Injectable()
export class MessagesHistoryService {
  private readonly logger = new Logger(MessagesHistoryService.name);

  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    private readonly socketService: SocketService,
    private readonly readTrackingService: ReadTrackingService,
  ) {}

  /**
   * Fetches past direct messages between current authenticated user and target user.
   */
  async getDirectMessages(
    currentUserId: string,
    targetUserId: string,
    query: QueryMessagesDto,
  ): Promise<ConversationHistoryResponse> {
    if (!targetUserId || typeof targetUserId !== 'string' || !targetUserId.trim()) {
      throw new BadRequestException('Target userId is required');
    }

    if (currentUserId === targetUserId) {
      throw new BadRequestException('Cannot fetch direct chat history with yourself');
    }

    const conversationId = getDirectConversationId(currentUserId, targetUserId.trim());
    const limit = sanitizeLimit(query.limit);
    const before = query.before?.trim();
    const after = query.after?.trim();

    const filter: Record<string, any> = { conversationId, isDeleted: { $ne: true } };
    if (after) {
      filter.messageId = { $gt: after };
    } else if (before) {
      filter.messageId = { $lt: before };
    }

    const sortOrder = after ? 1 : -1;

    const rawDocs = await this.messageModel
      .find(filter)
      .sort({ messageId: sortOrder })
      .limit(limit + 1)
      .lean()
      .exec();

    const hasMore = rawDocs.length > limit;
    const docs = hasMore ? rawDocs.slice(0, limit) : rawDocs;

    let oldestCursor: string | undefined;
    let newestCursor: string | undefined;

    if (after) {
      oldestCursor = docs.length > 0 ? docs[0].messageId : undefined;
      newestCursor = docs.length > 0 ? docs[docs.length - 1].messageId : undefined;
    } else {
      oldestCursor = docs.length > 0 ? docs[docs.length - 1].messageId : undefined;
      newestCursor = docs.length > 0 ? docs[0].messageId : undefined;
      docs.reverse();
    }

    const messages: ChatMessageResponse[] = docs.map((doc) =>
      formatMessageResponse(doc),
    );

    this.logger.log(
      `Retrieved ${messages.length} direct messages for conversation "${conversationId}" (hasMore: ${hasMore})`,
    );

    const partnerLastReadMessageId = await this.readTrackingService.getLastRead(
      targetUserId.trim(),
      conversationId,
    );

    return {
      conversationId,
      partnerLastReadMessageId,
      messages,
      hasMore: !after ? hasMore : false,
      hasNewer: after ? hasMore : false,
      oldestCursor,
      newestCursor,
    };
  }

  /**
   * Fetches past group messages for a given group.
   */
  async getGroupMessages(
    groupId: string,
    currentUserId: string,
    query: QueryMessagesDto,
  ): Promise<ConversationHistoryResponse> {
    if (!groupId || typeof groupId !== 'string' || !groupId.trim()) {
      throw new BadRequestException('groupId is required');
    }

    const cleanGroupId = groupId.trim();

    const memberIds = await this.socketService.getGroupMemberIds(cleanGroupId);
    if (!memberIds || memberIds.length === 0) {
      throw new NotFoundException(`Group "${cleanGroupId}" not found or has no active members`);
    }

    if (!memberIds.includes(currentUserId)) {
      this.logger.warn(
        `Unauthorized group history access attempt: User "${currentUserId}" is not in group "${cleanGroupId}"`,
      );
      throw new ForbiddenException('Forbidden: You are not a member of this group');
    }

    const conversationId = getGroupConversationId(cleanGroupId);
    const limit = sanitizeLimit(query.limit);
    const before = query.before?.trim();
    const after = query.after?.trim();

    const filter: Record<string, any> = { conversationId, isDeleted: { $ne: true } };
    if (after) {
      filter.messageId = { $gt: after };
    } else if (before) {
      filter.messageId = { $lt: before };
    }

    const sortOrder = after ? 1 : -1;

    const rawDocs = await this.messageModel
      .find(filter)
      .sort({ messageId: sortOrder })
      .limit(limit + 1)
      .lean()
      .exec();

    const hasMore = rawDocs.length > limit;
    const docs = hasMore ? rawDocs.slice(0, limit) : rawDocs;

    let oldestCursor: string | undefined;
    let newestCursor: string | undefined;

    if (after) {
      oldestCursor = docs.length > 0 ? docs[0].messageId : undefined;
      newestCursor = docs.length > 0 ? docs[docs.length - 1].messageId : undefined;
    } else {
      oldestCursor = docs.length > 0 ? docs[docs.length - 1].messageId : undefined;
      newestCursor = docs.length > 0 ? docs[0].messageId : undefined;
      docs.reverse();
    }

    const messages: ChatMessageResponse[] = docs.map((doc) =>
      formatMessageResponse(doc),
    );

    this.logger.log(
      `Retrieved ${messages.length} group messages for group "${cleanGroupId}" (hasMore: ${hasMore})`,
    );

    const memberLastReadMap: Record<string, string> = {};
    await Promise.all(
      memberIds.map(async (memberId) => {
        const lastRead = await this.readTrackingService.getLastRead(memberId, conversationId);
        if (lastRead) {
          memberLastReadMap[memberId] = lastRead;
        }
      }),
    );

    return {
      conversationId,
      groupId: cleanGroupId,
      memberLastReadMap,
      messages,
      hasMore: !after ? hasMore : false,
      hasNewer: after ? hasMore : false,
      oldestCursor,
      newestCursor,
    };
  }

  /**
   * Fetches a slice of messages surrounding a specific target messageId.
   */
  async getMessageContext(
    currentUserId: string,
    query: QueryMessageContextDto,
  ): Promise<MessageContextResponse> {
    const { messageId } = query || {};
    if (!messageId || typeof messageId !== 'string' || !messageId.trim()) {
      throw new BadRequestException('messageId is required');
    }

    const cleanMessageId = messageId.trim();
    const targetDoc = await this.messageModel
      .findOne({ messageId: cleanMessageId, isDeleted: { $ne: true } })
      .lean()
      .exec();
    if (!targetDoc) {
      throw new NotFoundException(`Message "${cleanMessageId}" not found or has been deleted`);
    }

    if (targetDoc.type === 'direct') {
      if (targetDoc.senderId !== currentUserId && targetDoc.recipientId !== currentUserId) {
        throw new ForbiddenException('Forbidden: You are not a participant in this direct chat');
      }
    } else if (targetDoc.type === 'group') {
      const groupId = targetDoc.groupId || targetDoc.conversationId.replace('group:', '');
      const memberIds = await this.socketService.getGroupMemberIds(groupId);
      if (!memberIds || !memberIds.includes(currentUserId)) {
        throw new ForbiddenException('Forbidden: You are not a member of this group');
      }
    }

    const surrounding = Math.max(
      5,
      Math.min(parseInt(String(query.surrounding || '25'), 10) || 25, 50),
    );
    const conversationId = targetDoc.conversationId;

    const [rawOlder, rawNewer] = await Promise.all([
      this.messageModel
        .find({ conversationId, isDeleted: { $ne: true }, messageId: { $lt: cleanMessageId } })
        .sort({ messageId: -1 })
        .limit(surrounding + 1)
        .lean()
        .exec(),
      this.messageModel
        .find({ conversationId, isDeleted: { $ne: true }, messageId: { $gt: cleanMessageId } })
        .sort({ messageId: 1 })
        .limit(surrounding + 1)
        .lean()
        .exec(),
    ]);

    const hasOlder = rawOlder.length > surrounding;
    const olderDocs = hasOlder ? rawOlder.slice(0, surrounding) : rawOlder;
    olderDocs.reverse();

    const hasNewer = rawNewer.length > surrounding;
    const newerDocs = hasNewer ? rawNewer.slice(0, surrounding) : rawNewer;

    const allDocs = [...olderDocs, targetDoc, ...newerDocs];
    const messages = allDocs.map((doc) => formatMessageResponse(doc));

    const oldestCursor = allDocs.length > 0 ? allDocs[0].messageId : undefined;
    const newestCursor = allDocs.length > 0 ? allDocs[allDocs.length - 1].messageId : undefined;

    let partnerLastReadMessageId: string | null | undefined;
    let memberLastReadMap: Record<string, string> | undefined;

    if (targetDoc.type === 'direct') {
      const partnerId =
        targetDoc.senderId === currentUserId ? targetDoc.recipientId : targetDoc.senderId;
      if (partnerId) {
        partnerLastReadMessageId = await this.readTrackingService.getLastRead(
          partnerId,
          conversationId,
        );
      }
    } else if (targetDoc.type === 'group') {
      const groupId = targetDoc.groupId || conversationId.replace('group:', '');
      const memberIds = await this.socketService.getGroupMemberIds(groupId);
      if (memberIds && memberIds.length > 0) {
        memberLastReadMap = {};
        await Promise.all(
          memberIds.map(async (mId) => {
            const lastRead = await this.readTrackingService.getLastRead(mId, conversationId);
            if (lastRead && memberLastReadMap) {
              memberLastReadMap[mId] = lastRead;
            }
          }),
        );
      }
    }

    return {
      conversationId,
      targetMessageId: cleanMessageId,
      messages,
      hasOlder,
      hasNewer,
      oldestCursor,
      newestCursor,
      partnerLastReadMessageId,
      memberLastReadMap,
    };
  }
}
