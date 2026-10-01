import {
  Injectable,
  Logger,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message, MessageDocument } from './schemas/message.schema';
import {
  PinnedMessage,
  PinnedMessageDocument,
} from './schemas/pinned-message.schema';
import {
  ReportedMessage,
  ReportedMessageDocument,
} from './schemas/reported-message.schema';
import { SocketService } from '../socket/socket.service';
import {
  getDirectConversationId,
  getGroupConversationId,
  MessageDeletedEvent,
} from '../socket/interfaces/socket-events.interface';
import {
  QueryMessagesDto,
  ConversationHistoryResponse,
  ChatMessageResponse,
  QueryMessageContextDto,
  MessageContextResponse,
  QueryDoubtsDto,
  DoubtsListResponse,
  PinnedMessageResponse,
  ReportMessageDto,
  QueryReportsDto,
  ReportedMessageResponse,
  ReportsListResponse,
} from './dto/query-messages.dto';
import { ReadTrackingService } from '../read-tracking/read-tracking.service';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    @InjectModel(PinnedMessage.name)
    private readonly pinnedMessageModel: Model<PinnedMessageDocument>,
    @InjectModel(ReportedMessage.name)
    private readonly reportedMessageModel: Model<ReportedMessageDocument>,
    private readonly socketService: SocketService,
    private readonly readTrackingService: ReadTrackingService,
  ) {}

  /**
   * Fetches past direct messages between current authenticated user and target user.
   * Query is indexed by { conversationId: 1, messageId: -1 }.
   * Returns messages in chronological order (oldest to newest).
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
    const limit = this.sanitizeLimit(query.limit);
    const before = query.before?.trim();
    const after = query.after?.trim();

    const filter: Record<string, any> = { conversationId, isDeleted: { $ne: true } };
    if (after) {
      filter.messageId = { $gt: after };
    } else if (before) {
      filter.messageId = { $lt: before };
    }

    const sortOrder = after ? 1 : -1;

    // Fetch limit + 1 to reliably detect if more messages exist
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
      // Reverse to chronological order (oldest -> newest) for client rendering
      docs.reverse();
    }

    const messages: ChatMessageResponse[] = docs.map((doc) =>
      this.formatMessageResponse(doc),
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
   * Verifies that the requester is an active group member via user-service.
   * Returns messages in chronological order (oldest to newest).
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

    // 1. Authorize: verify user is an active member of this group
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
    const limit = this.sanitizeLimit(query.limit);
    const before = query.before?.trim();
    const after = query.after?.trim();

    const filter: Record<string, any> = { conversationId, isDeleted: { $ne: true } };
    if (after) {
      filter.messageId = { $gt: after };
    } else if (before) {
      filter.messageId = { $lt: before };
    }

    const sortOrder = after ? 1 : -1;

    // Fetch limit + 1 to detect older/newer messages
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
      // Reverse to chronological order (oldest -> newest)
      docs.reverse();
    }

    const messages: ChatMessageResponse[] = docs.map((doc) =>
      this.formatMessageResponse(doc),
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
   * Modular navigation primitive: used for jumping to replies, pinned messages, search results.
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

    // 1. Authorize user access to this conversation
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

    // 2. Fetch older and newer slices in parallel
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
    olderDocs.reverse(); // back to chronological (oldest to newest)

    const hasNewer = rawNewer.length > surrounding;
    const newerDocs = hasNewer ? rawNewer.slice(0, surrounding) : rawNewer;

    const allDocs = [...olderDocs, targetDoc, ...newerDocs];
    const messages = allDocs.map((doc) => this.formatMessageResponse(doc));

    const oldestCursor = allDocs.length > 0 ? allDocs[0].messageId : undefined;
    const newestCursor = allDocs.length > 0 ? allDocs[allDocs.length - 1].messageId : undefined;

    // 3. Fetch read watermarks
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

  /**
   * Updates doubt status (OPEN <-> RESOLVED) with authorization validation.
   */
  async updateDoubtStatus(
    currentUserId: string,
    userRole: string,
    userName: string,
    conversationId: string,
    messageId: string,
    status: 'OPEN' | 'RESOLVED',
  ): Promise<ChatMessageResponse> {
    if (!messageId || !conversationId || !status) {
      throw new BadRequestException('messageId, conversationId, and status are required');
    }

    const message = await this.messageModel.findOne({ messageId, conversationId });
    if (!message) {
      throw new NotFoundException(`Message "${messageId}" not found in conversation`);
    }

    if (!message.isDoubt) {
      throw new BadRequestException('This message is not marked as a doubt');
    }

    // Authorization checks
    const roleNormalized = (userRole || '').toUpperCase();
    const isMentorOrAdmin = roleNormalized === 'MENTOR' || roleNormalized === 'ADMIN';

    if (message.type === 'direct') {
      if (message.senderId !== currentUserId && message.recipientId !== currentUserId) {
        throw new ForbiddenException('Forbidden: You are not a participant in this direct chat');
      }
    } else if (message.type === 'group') {
      const groupId = message.groupId || conversationId.replace('group:', '');
      const memberIds = await this.socketService.getGroupMemberIds(groupId);
      if (!memberIds || !memberIds.includes(currentUserId)) {
        throw new ForbiddenException('Forbidden: You are not a member of this group');
      }

      // In groups: either a mentor/admin or the original author mentee can resolve/reopen
      const isOriginalAuthor = message.senderId === currentUserId;
      if (!isMentorOrAdmin && !isOriginalAuthor) {
        throw new ForbiddenException(
          'Forbidden: Only mentors or the doubt author can change doubt resolution status',
        );
      }
    }

    if (status === 'RESOLVED') {
      message.doubtStatus = 'RESOLVED';
      message.resolvedBy = currentUserId;
      message.resolvedByName = userName || 'Mentor';
      message.resolvedAt = new Date();
    } else {
      message.doubtStatus = 'OPEN';
      message.resolvedBy = undefined;
      message.resolvedByName = undefined;
      message.resolvedAt = undefined;
    }

    await message.save();
    return this.formatMessageResponse(message);
  }

  /**
   * Fetches doubts for a given conversation with counts.
   */
  async getDoubts(
    currentUserId: string,
    query: QueryDoubtsDto,
  ): Promise<DoubtsListResponse> {
    const { conversationId, status } = query || {};
    if (!conversationId) {
      throw new BadRequestException('conversationId is required');
    }

    // Verify user authorization for conversation
    if (conversationId.startsWith('direct:')) {
      const parts = conversationId.replace('direct:', '').split(':');
      if (!parts.includes(currentUserId)) {
        throw new ForbiddenException('Forbidden: Not a participant in this conversation');
      }
    } else if (conversationId.startsWith('group:')) {
      const groupId = conversationId.replace('group:', '');
      const memberIds = await this.socketService.getGroupMemberIds(groupId);
      if (!memberIds || !memberIds.includes(currentUserId)) {
        throw new ForbiddenException('Forbidden: Not a member of this group');
      }
    }

    const filter: Record<string, any> = {
      conversationId,
      isDoubt: true,
      isDeleted: { $ne: true },
    };
    if (status && status !== 'ALL') {
      filter.doubtStatus = status;
    }

    const limit = this.sanitizeLimit(query.limit);
    const docs = await this.messageModel
      .find(filter)
      .sort({ messageId: -1 })
      .limit(limit)
      .lean()
      .exec();

    const openCount = await this.messageModel.countDocuments({
      conversationId,
      isDoubt: true,
      doubtStatus: 'OPEN',
      isDeleted: { $ne: true },
    });
    const resolvedCount = await this.messageModel.countDocuments({
      conversationId,
      isDoubt: true,
      doubtStatus: 'RESOLVED',
      isDeleted: { $ne: true },
    });

    return {
      conversationId,
      doubts: docs.map((d) => this.formatMessageResponse(d)),
      total: openCount + resolvedCount,
      openCount,
      resolvedCount,
    };
  }

  /**
   * Clamps limit between 1 and 100 with default 50.
   */
  private sanitizeLimit(limit?: string | number): number {
    const parsed = typeof limit === 'number' ? limit : parseInt(String(limit || '50'), 10);
    if (isNaN(parsed) || parsed < 1) {
      return 50;
    }
    return Math.min(parsed, 100);
  }

  /**
   * Normalizes MongoDB document to consistent DTO response.
   */
  private formatMessageResponse(doc: any): ChatMessageResponse {
    const timestampIso =
      doc.timestamp instanceof Date
        ? doc.timestamp.toISOString()
        : new Date(doc.timestamp).toISOString();

    const resolvedAtIso = doc.resolvedAt
      ? doc.resolvedAt instanceof Date
        ? doc.resolvedAt.toISOString()
        : new Date(doc.resolvedAt).toISOString()
      : undefined;

    return {
      id: doc.messageId,
      messageId: doc.messageId,
      conversationId: doc.conversationId,
      clientMessageId: doc.clientMessageId,
      type: doc.type,
      senderId: doc.senderId,
      recipientId: doc.recipientId,
      groupId: doc.groupId,
      text: doc.content,
      content: doc.content,
      attachments: doc.attachments || [],
      status: doc.status || 'sent',
      timestamp: timestampIso,
      isAnnouncement: !!doc.isAnnouncement,
      heading: doc.heading,
      replyTo: doc.replyTo
        ? {
            messageId: doc.replyTo.messageId,
            senderId: doc.replyTo.senderId,
            text: doc.replyTo.text,
          }
        : undefined,
      isDoubt: !!doc.isDoubt,
      doubtStatus: doc.doubtStatus,
      doubtTopic: doc.doubtTopic,
      resolvedBy: doc.resolvedBy,
      resolvedByName: doc.resolvedByName,
      resolvedAt: resolvedAtIso,
    };
  }

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

    // Verify user authorization for conversation
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
   * RBAC: Mentors/Admins in groups, participants in direct chats.
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

    // 1. Fetch target message to pin
    const messageDoc = await this.messageModel
      .findOne({ messageId: cleanMsgId })
      .lean()
      .exec();

    if (!messageDoc) {
      throw new NotFoundException(`Message "${cleanMsgId}" not found`);
    }

    // 2. Authorize
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

    // 3. Return existing if already pinned (idempotent)
    const existing = await this.pinnedMessageModel
      .findOne({ conversationId: cleanConvoId, messageId: cleanMsgId })
      .lean()
      .exec();

    if (existing) {
      return this.formatPinnedResponse(existing);
    }

    // 4. FIFO Cap: If >= 5 pins, unpin the oldest pin(s)
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

    // 5. Build snapshot & create
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

    // 6. Broadcast real-time pin event
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

    // 1. Authorize
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

    // 2. Delete pin
    const deleted = await this.pinnedMessageModel.findOneAndDelete({
      conversationId: cleanConvoId,
      messageId: cleanMsgId,
    });

    if (!deleted) {
      throw new NotFoundException(
        `Pinned message "${cleanMsgId}" not found in conversation "${cleanConvoId}"`,
      );
    }

    // 3. Broadcast unpin event
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
  private async broadcastPinEvent(
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
    } catch (err) {
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

  /**
   * Reports a message.
   * Saves a snapshot of the message, reportedBy, and optional reason.
   */
  async reportMessage(
    currentUserId: string,
    messageId: string,
    dto: ReportMessageDto,
  ): Promise<{ status: string; message: string; reportId: string }> {
    if (!messageId || typeof messageId !== 'string' || !messageId.trim()) {
      throw new BadRequestException('Message ID is required');
    }

    const cleanMsgId = messageId.trim();
    const messageDoc = await this.messageModel
      .findOne({ messageId: cleanMsgId })
      .lean()
      .exec();

    if (!messageDoc) {
      throw new NotFoundException(`Message '${cleanMsgId}' not found`);
    }

    // Check if current user already reported this message
    const existing = await this.reportedMessageModel
      .findOne({ messageId: cleanMsgId, reportedBy: currentUserId })
      .lean()
      .exec();

    if (existing) {
      throw new ConflictException('You have already reported this message');
    }

    const snapshot = {
      messageId: messageDoc.messageId,
      conversationId: messageDoc.conversationId,
      senderId: messageDoc.senderId,
      recipientId: messageDoc.recipientId,
      groupId: messageDoc.groupId,
      type: messageDoc.type,
      content: messageDoc.content || '',
      heading: messageDoc.heading,
      isAnnouncement: !!messageDoc.isAnnouncement,
      isDoubt: !!messageDoc.isDoubt,
      doubtStatus: messageDoc.doubtStatus,
      doubtTopic: messageDoc.doubtTopic,
      timestamp: messageDoc.timestamp ? new Date(messageDoc.timestamp) : new Date(),
      attachments: messageDoc.attachments || [],
    };

    const created = await this.reportedMessageModel.create({
      messageId: cleanMsgId,
      conversationId: messageDoc.conversationId,
      reportedBy: currentUserId,
      reason: dto?.reason?.trim() || null,
      status: 'PENDING',
      message: snapshot,
    });

    this.logger.log(
      `User ${currentUserId} reported message ${cleanMsgId} in conversation ${messageDoc.conversationId} (Report: ${created._id})`,
    );

    return {
      status: 'success',
      message: 'Message reported successfully',
      reportId: String(created._id),
    };
  }

  /**
   * Fetches all reports with senderName and reporterName resolved.
   * Access is strictly restricted to ADMIN role.
   */
  async getReportedMessages(
    currentUserId: string,
    currentUserRole: string,
    query: QueryReportsDto,
  ): Promise<ReportsListResponse> {
    if (currentUserRole !== 'ADMIN') {
      throw new ForbiddenException(
        'Forbidden: Only administrators can view reports',
      );
    }

    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const page = Math.max(Number(query.page) || 1, 1);
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};
    if (
      query.status &&
      ['PENDING', 'REVIEWED', 'DISMISSED'].includes(query.status.toUpperCase())
    ) {
      filter.status = query.status.toUpperCase();
    }

    const [total, docs] = await Promise.all([
      this.reportedMessageModel.countDocuments(filter).exec(),
      this.reportedMessageModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
    ]);

    // Collect unique user IDs to resolve senderName and reporterName
    const userIds: string[] = [];
    for (const doc of docs) {
      if (doc.reportedBy) userIds.push(doc.reportedBy);
      if (doc.message?.senderId) userIds.push(doc.message.senderId);
    }

    const userNamesMap = await this.getUserNamesMap(userIds);

    const reports: ReportedMessageResponse[] = docs.map((doc: any) => {
      const senderId = doc.message?.senderId;
      const reportedBy = doc.reportedBy;
      const createdAtIso =
        doc.createdAt instanceof Date
          ? doc.createdAt.toISOString()
          : new Date(doc.createdAt || Date.now()).toISOString();

      const timestampIso =
        doc.message?.timestamp instanceof Date
          ? doc.message.timestamp.toISOString()
          : new Date(doc.message?.timestamp || Date.now()).toISOString();

      return {
        id: String(doc._id),
        messageId: doc.messageId,
        conversationId: doc.conversationId,
        reportedBy,
        reporterName: userNamesMap.get(reportedBy) || 'Unknown User',
        senderName: userNamesMap.get(senderId) || 'Unknown User',
        reason: doc.reason || undefined,
        status: doc.status,
        createdAt: createdAtIso,
        message: {
          messageId: doc.message?.messageId,
          conversationId: doc.message?.conversationId,
          senderId,
          recipientId: doc.message?.recipientId,
          groupId: doc.message?.groupId,
          type: doc.message?.type,
          content: doc.message?.content || '',
          heading: doc.message?.heading,
          isAnnouncement: !!doc.message?.isAnnouncement,
          isDoubt: !!doc.message?.isDoubt,
          doubtStatus: doc.message?.doubtStatus,
          doubtTopic: doc.message?.doubtTopic,
          timestamp: timestampIso,
          attachments: doc.message?.attachments || [],
        },
      };
    });

    return {
      status: 'ok',
      total,
      page,
      limit,
      reports,
    };
  }

  /**
   * Helper to batch-fetch display names for given user IDs from user-service.
   */
  private async getUserNamesMap(userIds: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const userServiceUrl =
      process.env.USER_SERVICE_URL || 'http://localhost:3002';
    const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));

    await Promise.all(
      uniqueIds.map(async (userId) => {
        try {
          const res = await fetch(
            `${userServiceUrl}/api/users/${encodeURIComponent(userId)}`,
          );
          if (res.ok) {
            const data = (await res.json()) as {
              name?: string;
              username?: string;
            };
            if (data?.name) {
              map.set(userId, data.name);
            } else if (data?.username) {
              map.set(userId, data.username);
            }
          }
        } catch (err: any) {
          this.logger.warn(
            `Failed to fetch user name for ${userId}: ${err.message}`,
          );
        }
      }),
    );

    return map;
  }

  /**
   * Soft-deletes a message.
   * Authorization rules:
   * - Author can delete their own message (direct or group).
   * - Mentor/Admin can delete any message in their group.
   * - Otherwise Forbidden.
   */
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

      // Verify caller is a member of this specific group
      const memberIds = await this.socketService.getGroupMemberIds(messageDoc.groupId);
      if (!memberIds || !memberIds.includes(currentUserId)) {
        throw new ForbiddenException('Forbidden: You are not a member of this group');
      }
    }

    // 1. Soft delete in MongoDB
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

    // 2. Cleanup from pinned_messages if pinned
    const existingPin = await this.pinnedMessageModel
      .findOne({ conversationId: cleanConvoId, messageId: cleanMsgId })
      .lean()
      .exec();

    if (existingPin) {
      await this.pinnedMessageModel.deleteOne({ _id: existingPin._id });
      await this.broadcastPinEvent(cleanConvoId, 'message_unpinned', {
        conversationId: cleanConvoId,
        messageId: cleanMsgId,
      });
    }

    // 3. Broadcast real-time socket event
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

  /**
   * Broadcasts message_deleted event to all conversation participants.
   */
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

