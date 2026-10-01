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
import {
  PinnedMessage,
  PinnedMessageDocument,
} from '../schemas/pinned-message.schema';
import { SocketService } from '../../socket/socket.service';
import { PinnedMessageResponse } from '../dto/query-messages.dto';

@Injectable()
export class PinsService {
  private readonly logger = new Logger(PinsService.name);

  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    @InjectModel(PinnedMessage.name)
    private readonly pinnedMessageModel: Model<PinnedMessageDocument>,
    private readonly socketService: SocketService,
  ) {}

  /**
   * Fetches all active pinned messages for a conversation, sorted newest pinned first.
   */
  async getPinnedMessages(
    currentUserId: string,
    conversationId: string,
  ): Promise<PinnedMessageResponse[]> {
    if (!conversationId || typeof conversationId !== 'string' || !conversationId.trim()) {
      throw new BadRequestException('conversationId is required');
    }
    const cleanConvoId = conversationId.trim();

    if (cleanConvoId.startsWith('direct:')) {
      const parts = cleanConvoId.replace('direct:', '').split(':');
      if (!parts.includes(currentUserId)) {
        throw new ForbiddenException('Forbidden: Not a participant in this conversation');
      }
    } else if (cleanConvoId.startsWith('group:')) {
      const groupId = cleanConvoId.replace('group:', '');
      const memberIds = await this.socketService.getGroupMemberIds(groupId);
      if (!memberIds || !memberIds.includes(currentUserId)) {
        throw new ForbiddenException('Forbidden: Not a member of this group');
      }
    }

    const docs = await this.pinnedMessageModel
      .find({ conversationId: cleanConvoId })
      .sort({ pinnedAt: -1 })
      .lean()
      .exec();

    return docs.map((doc) => this.formatPinnedResponse(doc));
  }

  /**
   * Pins a message in a conversation. Enforces FIFO max cap of 5 pins.
   */
  async pinMessage(
    currentUserId: string,
    currentUserRole: string,
    currentUserName: string,
    conversationId: string,
    messageId: string,
  ): Promise<PinnedMessageResponse> {
    if (!conversationId || !conversationId.trim()) {
      throw new BadRequestException('conversationId is required');
    }
    if (!messageId || !messageId.trim()) {
      throw new BadRequestException('messageId is required');
    }

    const cleanConvoId = conversationId.trim();
    const cleanMsgId = messageId.trim();

    const messageDoc = await this.messageModel
      .findOne({ messageId: cleanMsgId })
      .lean()
      .exec();

    if (!messageDoc) {
      throw new NotFoundException(`Message "${cleanMsgId}" not found`);
    }

    const roleNormalized = (currentUserRole || '').toUpperCase();
    const isMentorOrAdmin = roleNormalized === 'MENTOR' || roleNormalized === 'ADMIN';

    if (cleanConvoId.startsWith('direct:')) {
      const parts = cleanConvoId.replace('direct:', '').split(':');
      if (!parts.includes(currentUserId)) {
        throw new ForbiddenException('Forbidden: Not a participant in this conversation');
      }
    } else if (cleanConvoId.startsWith('group:')) {
      const groupId = cleanConvoId.replace('group:', '');
      const memberIds = await this.socketService.getGroupMemberIds(groupId);
      if (!memberIds || !memberIds.includes(currentUserId)) {
        throw new ForbiddenException('Forbidden: Not a member of this group');
      }
      if (!isMentorOrAdmin) {
        throw new ForbiddenException('Forbidden: Only mentors or admins can pin messages in groups');
      }
    }

    const existing = await this.pinnedMessageModel
      .findOne({ conversationId: cleanConvoId, messageId: cleanMsgId })
      .lean()
      .exec();

    if (existing) {
      return this.formatPinnedResponse(existing);
    }

    const MAX_PINS = 5;
    const currentPins = await this.pinnedMessageModel
      .find({ conversationId: cleanConvoId })
      .sort({ pinnedAt: 1 })
      .exec();

    if (currentPins.length >= MAX_PINS) {
      const toEvictCount = currentPins.length - MAX_PINS + 1;
      const evicted = currentPins.slice(0, toEvictCount);
      for (const oldPin of evicted) {
        await this.pinnedMessageModel.deleteOne({ _id: oldPin._id });
        await this.broadcastPinEvent(cleanConvoId, 'message_unpinned', {
          conversationId: cleanConvoId,
          messageId: oldPin.messageId,
        });
      }
    }

    const snapshot = {
      senderId: messageDoc.senderId,
      senderName: currentUserId === messageDoc.senderId ? currentUserName : undefined,
      content: messageDoc.content,
      heading: messageDoc.heading,
      isAnnouncement: !!messageDoc.isAnnouncement,
      isDoubt: !!messageDoc.isDoubt,
      doubtStatus: messageDoc.doubtStatus,
      doubtTopic: messageDoc.doubtTopic,
      timestamp: messageDoc.timestamp,
      attachments: messageDoc.attachments || [],
    };

    const newPin = await this.pinnedMessageModel.create({
      conversationId: cleanConvoId,
      messageId: cleanMsgId,
      pinnedBy: currentUserId,
      pinnedByName: currentUserName || 'Mentor',
      pinnedAt: new Date(),
      snapshot,
    });

    const response = this.formatPinnedResponse(newPin.toObject ? newPin.toObject() : newPin);

    await this.broadcastPinEvent(cleanConvoId, 'message_pinned', {
      conversationId: cleanConvoId,
      pin: response,
    });

    return response;
  }

  /**
   * Unpins a message in a conversation.
   */
  async unpinMessage(
    currentUserId: string,
    currentUserRole: string,
    conversationId: string,
    messageId: string,
  ): Promise<{ success: boolean; conversationId: string; messageId: string }> {
    if (!conversationId || !conversationId.trim()) {
      throw new BadRequestException('conversationId is required');
    }
    if (!messageId || !messageId.trim()) {
      throw new BadRequestException('messageId is required');
    }

    const cleanConvoId = conversationId.trim();
    const cleanMsgId = messageId.trim();

    const roleNormalized = (currentUserRole || '').toUpperCase();
    const isMentorOrAdmin = roleNormalized === 'MENTOR' || roleNormalized === 'ADMIN';

    if (cleanConvoId.startsWith('direct:')) {
      const parts = cleanConvoId.replace('direct:', '').split(':');
      if (!parts.includes(currentUserId)) {
        throw new ForbiddenException('Forbidden: Not a participant in this conversation');
      }
    } else if (cleanConvoId.startsWith('group:')) {
      const groupId = cleanConvoId.replace('group:', '');
      const memberIds = await this.socketService.getGroupMemberIds(groupId);
      if (!memberIds || !memberIds.includes(currentUserId)) {
        throw new ForbiddenException('Forbidden: Not a member of this group');
      }
      if (!isMentorOrAdmin) {
        throw new ForbiddenException('Forbidden: Only mentors or admins can unpin messages in groups');
      }
    }

    const deleted = await this.pinnedMessageModel.findOneAndDelete({
      conversationId: cleanConvoId,
      messageId: cleanMsgId,
    });

    if (!deleted) {
      throw new NotFoundException(
        `Pinned message "${cleanMsgId}" not found in conversation "${cleanConvoId}"`,
      );
    }

    await this.broadcastPinEvent(cleanConvoId, 'message_unpinned', {
      conversationId: cleanConvoId,
      messageId: cleanMsgId,
    });

    return {
      success: true,
      conversationId: cleanConvoId,
      messageId: cleanMsgId,
    };
  }

  /**
   * Broadcasts pin lifecycle events to all conversation participants.
   */
  async broadcastPinEvent(
    conversationId: string,
    eventName: string,
    payload: any,
  ): Promise<void> {
    try {
      if (conversationId.startsWith('direct:')) {
        const parts = conversationId.replace('direct:', '').split(':');
        this.socketService.emitToUsers(parts, eventName, payload);
      } else if (conversationId.startsWith('group:')) {
        const groupId = conversationId.replace('group:', '');
        const memberIds = await this.socketService.getGroupMemberIds(groupId);
        if (memberIds && memberIds.length > 0) {
          this.socketService.emitToUsers(memberIds, eventName, payload);
        }
      }
    } catch (err: any) {
      this.logger.error(
        `Failed to broadcast pin event "${eventName}" to conversation "${conversationId}": ${err?.message || err}`,
      );
    }
  }

  /**
   * Formats a raw pinned message document into PinnedMessageResponse DTO.
   */
  private formatPinnedResponse(doc: any): PinnedMessageResponse {
    const timestampIso =
      doc.snapshot?.timestamp instanceof Date
        ? doc.snapshot.timestamp.toISOString()
        : new Date(doc.snapshot?.timestamp || Date.now()).toISOString();

    const pinnedAtIso =
      doc.pinnedAt instanceof Date
        ? doc.pinnedAt.toISOString()
        : new Date(doc.pinnedAt || Date.now()).toISOString();

    return {
      id: doc._id ? String(doc._id) : doc.messageId,
      conversationId: doc.conversationId,
      messageId: doc.messageId,
      pinnedBy: doc.pinnedBy,
      pinnedByName: doc.pinnedByName,
      pinnedAt: pinnedAtIso,
      snapshot: {
        senderId: doc.snapshot?.senderId,
        senderName: doc.snapshot?.senderName,
        content: doc.snapshot?.content || '',
        heading: doc.snapshot?.heading,
        isAnnouncement: !!doc.snapshot?.isAnnouncement,
        isDoubt: !!doc.snapshot?.isDoubt,
        doubtStatus: doc.snapshot?.doubtStatus,
        doubtTopic: doc.snapshot?.doubtTopic,
        timestamp: timestampIso,
        attachments: doc.snapshot?.attachments || [],
      },
    };
  }
}
