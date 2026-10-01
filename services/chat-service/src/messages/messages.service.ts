import {
  Injectable,
  Logger,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message, MessageDocument } from './schemas/message.schema';
import {
  PinnedMessage,
  PinnedMessageDocument,
} from './schemas/pinned-message.schema';
import { SocketService } from '../socket/socket.service';
import {
  MessageDeletedEvent,
} from '../socket/interfaces/socket-events.interface';
import {
  QueryMessagesDto,
  QueryMessageContextDto,
  QueryDoubtsDto,
  QueryMentorDoubtsDto,
  ReportMessageDto,
  QueryReportsDto,
} from './dto';
import {
  ConversationHistoryResponse,
  ChatMessageResponse,
  MessageContextResponse,
  DoubtsListResponse,
  MentorDoubtsResponse,
  PinnedMessageResponse,
  ReportsListResponse,
} from './interfaces';
import { MessagesHistoryService } from './services/messages-history.service';
import { DoubtsService } from './services/doubts.service';
import { PinsService } from './services/pins.service';
import { ReportsService } from './services/reports.service';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    @InjectModel(PinnedMessage.name)
    private readonly pinnedMessageModel: Model<PinnedMessageDocument>,
    private readonly socketService: SocketService,
    private readonly historyService: MessagesHistoryService,
    private readonly doubtsService: DoubtsService,
    private readonly pinsService: PinsService,
    private readonly reportsService: ReportsService,
  ) {}

  // ---------------------------------------------------------------------------
  // Message History & Context (Delegated to MessagesHistoryService)
  // ---------------------------------------------------------------------------

  async getDirectMessages(
    currentUserId: string,
    targetUserId: string,
    query: QueryMessagesDto,
  ): Promise<ConversationHistoryResponse> {
    return this.historyService.getDirectMessages(currentUserId, targetUserId, query);
  }

  async getGroupMessages(
    groupId: string,
    currentUserId: string,
    query: QueryMessagesDto,
  ): Promise<ConversationHistoryResponse> {
    return this.historyService.getGroupMessages(groupId, currentUserId, query);
  }

  async getMessageContext(
    currentUserId: string,
    query: QueryMessageContextDto,
  ): Promise<MessageContextResponse> {
    return this.historyService.getMessageContext(currentUserId, query);
  }

  // ---------------------------------------------------------------------------
  // Doubts Lifecycle (Delegated to DoubtsService)
  // ---------------------------------------------------------------------------

  async updateDoubtStatus(
    currentUserId: string,
    userRole: string,
    userName: string,
    conversationId: string,
    messageId: string,
    status: 'OPEN' | 'RESOLVED',
  ): Promise<ChatMessageResponse> {
    return this.doubtsService.updateDoubtStatus(
      currentUserId,
      userRole,
      userName,
      conversationId,
      messageId,
      status,
    );
  }

  async getDoubts(
    currentUserId: string,
    query: QueryDoubtsDto,
  ): Promise<DoubtsListResponse> {
    return this.doubtsService.getDoubts(currentUserId, query);
  }

  async isUserMentor(userId: string, roleHeader?: string): Promise<boolean> {
    return this.doubtsService.isUserMentor(userId, roleHeader);
  }

  async getMentorDoubts(
    currentUserId: string,
    query?: QueryMentorDoubtsDto,
  ): Promise<MentorDoubtsResponse> {
    return this.doubtsService.getMentorDoubts(currentUserId, query);
  }

  // ---------------------------------------------------------------------------
  // Pinned Messages (Delegated to PinsService)
  // ---------------------------------------------------------------------------

  async getPinnedMessages(
    currentUserId: string,
    conversationId: string,
  ): Promise<PinnedMessageResponse[]> {
    return this.pinsService.getPinnedMessages(currentUserId, conversationId);
  }

  async pinMessage(
    currentUserId: string,
    currentUserRole: string,
    currentUserName: string,
    conversationId: string,
    messageId: string,
  ): Promise<PinnedMessageResponse> {
    return this.pinsService.pinMessage(
      currentUserId,
      currentUserRole,
      currentUserName,
      conversationId,
      messageId,
    );
  }

  async unpinMessage(
    currentUserId: string,
    currentUserRole: string,
    conversationId: string,
    messageId: string,
  ): Promise<{ success: boolean; conversationId: string; messageId: string }> {
    return this.pinsService.unpinMessage(
      currentUserId,
      currentUserRole,
      conversationId,
      messageId,
    );
  }

  // ---------------------------------------------------------------------------
  // Reported Messages (Delegated to ReportsService)
  // ---------------------------------------------------------------------------

  async reportMessage(
    currentUserId: string,
    messageId: string,
    dto: ReportMessageDto,
  ): Promise<{ status: string; message: string; reportId: string }> {
    return this.reportsService.reportMessage(currentUserId, messageId, dto);
  }

  async getReportedMessages(
    currentUserId: string,
    currentUserRole: string,
    query: QueryReportsDto,
  ): Promise<ReportsListResponse> {
    return this.reportsService.getReportedMessages(
      currentUserId,
      currentUserRole,
      query,
    );
  }

  // ---------------------------------------------------------------------------
  // Message Lifecycle & Soft Delete
  // ---------------------------------------------------------------------------

  async deleteMessage(
    currentUserId: string,
    currentUserRole: string,
    messageId: string,
  ): Promise<{ status: string; message: string; messageId: string; conversationId: string }> {
    if (!messageId || typeof messageId !== 'string' || !messageId.trim()) {
      throw new BadRequestException('Message ID is required');
    }

    const cleanMsgId = messageId.trim();
    const messageDoc = await this.messageModel
      .findOne({ messageId: cleanMsgId, isDeleted: { $ne: true } })
      .lean()
      .exec();

    if (!messageDoc) {
      throw new NotFoundException(`Message '${cleanMsgId}' not found or already deleted`);
    }

    const isAuthor = messageDoc.senderId === currentUserId;
    const roleNormalized = (currentUserRole || '').toUpperCase();
    const isMentorOrAdmin = roleNormalized === 'ADMIN' || roleNormalized === 'MENTOR';

    if (!isAuthor) {
      if (messageDoc.type !== 'group' || !messageDoc.groupId) {
        throw new ForbiddenException('Forbidden: You can only delete your own direct messages');
      }

      if (!isMentorOrAdmin) {
        throw new ForbiddenException(
          'Forbidden: Only mentors or admins can delete messages from other members in a group',
        );
      }

      const memberIds = await this.socketService.getGroupMemberIds(messageDoc.groupId);
      if (!memberIds || !memberIds.includes(currentUserId)) {
        throw new ForbiddenException('Forbidden: You are not a member of this group');
      }
    }

    await this.messageModel.updateOne(
      { messageId: cleanMsgId },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: currentUserId,
        },
      },
    );

    const cleanConvoId = messageDoc.conversationId;

    const existingPin = await this.pinnedMessageModel
      .findOne({ conversationId: cleanConvoId, messageId: cleanMsgId })
      .lean()
      .exec();

    if (existingPin) {
      await this.pinnedMessageModel.deleteOne({ _id: existingPin._id });
      await this.pinsService.broadcastPinEvent(cleanConvoId, 'message_unpinned', {
        conversationId: cleanConvoId,
        messageId: cleanMsgId,
      });
    }

    await this.broadcastDeleteEvent(cleanConvoId, cleanMsgId, currentUserId);

    this.logger.log(
      `Message ${cleanMsgId} soft-deleted by user ${currentUserId} (Role: ${currentUserRole}) in conversation ${cleanConvoId}`,
    );

    return {
      status: 'success',
      message: 'Message deleted successfully',
      messageId: cleanMsgId,
      conversationId: cleanConvoId,
    };
  }

  private async broadcastDeleteEvent(
    conversationId: string,
    messageId: string,
    deletedBy: string,
  ): Promise<void> {
    try {
      const payload: MessageDeletedEvent = {
        conversationId,
        messageId,
        deletedBy,
      };

      if (conversationId.startsWith('direct:')) {
        const parts = conversationId.replace('direct:', '').split(':');
        this.socketService.emitToUsers(parts, 'message_deleted', payload);
      } else if (conversationId.startsWith('group:')) {
        const groupId = conversationId.replace('group:', '');
        const memberIds = await this.socketService.getGroupMemberIds(groupId);
        if (memberIds && memberIds.length > 0) {
          this.socketService.emitToUsers(memberIds, 'message_deleted', payload);
        }
      }
    } catch (err: any) {
      this.logger.error(
        `Failed to broadcast message_deleted event to conversation "${conversationId}": ${err?.message || err}`,
      );
    }
  }
}
