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
import { Message, MessageDocument } from '../schemas/message.schema';
import {
  ReportedMessage,
  ReportedMessageDocument,
} from '../schemas/reported-message.schema';
import {
  ReportMessageDto,
  QueryReportsDto,
} from '../dto';
import {
  ReportedMessageResponse,
  ReportsListResponse,
} from '../interfaces';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    @InjectModel(ReportedMessage.name)
    private readonly reportedMessageModel: Model<ReportedMessageDocument>,
  ) {}

  /**
   * Reports a message.
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
  async getUserNamesMap(userIds: string[]): Promise<Map<string, string>> {
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
}
