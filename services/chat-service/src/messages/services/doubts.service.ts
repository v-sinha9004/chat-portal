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
import {
  QueryDoubtsDto,
  QueryMentorDoubtsDto,
} from '../dto';
import {
  ChatMessageResponse,
  DoubtsListResponse,
  MentorDoubtsResponse,
} from '../interfaces';
import {
  sanitizeLimit,
  formatMessageResponse,
} from '../utils/message-format.util';

@Injectable()
export class DoubtsService {
  private readonly logger = new Logger(DoubtsService.name);

  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    private readonly socketService: SocketService,
  ) {}

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
    return formatMessageResponse(message);
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

    const limit = sanitizeLimit(query.limit);
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
      doubts: docs.map((d) => formatMessageResponse(d)),
      total: openCount + resolvedCount,
      openCount,
      resolvedCount,
    };
  }

  /**
   * Verifies if a user has the MENTOR role.
   */
  async isUserMentor(userId: string, roleHeader?: string): Promise<boolean> {
    const roleNormalized = (roleHeader || '').toUpperCase();
    if (roleNormalized === 'MENTOR') {
      return true;
    }
    if (roleNormalized && roleNormalized !== 'MENTOR') {
      return false;
    }

    const userServiceUrl = process.env.USER_SERVICE_URL || 'http://localhost:3002';
    try {
      const response = await fetch(
        `${userServiceUrl}/api/users/${encodeURIComponent(userId)}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) {
        return false;
      }

      const userData = (await response.json()) as { role?: string };
      return (userData?.role || '').toUpperCase() === 'MENTOR';
    } catch (err: any) {
      this.logger.error(
        `Failed to check user role with user-service for ${userId}: ${err?.message}`,
      );
      return false;
    }
  }

  /**
   * Fetches all doubts for a mentor across groups and direct chats.
   */
  async getMentorDoubts(
    currentUserId: string,
    query?: QueryMentorDoubtsDto,
  ): Promise<MentorDoubtsResponse> {
    const targetUserId = query?.mentorId || query?.userId || currentUserId;
    if (!targetUserId || typeof targetUserId !== 'string' || !targetUserId.trim()) {
      throw new BadRequestException('User or mentor ID is required');
    }

    const mentorId = targetUserId.trim();

    let groupIds: string[] = [];
    if (query?.groupId) {
      groupIds = [query.groupId.trim()];
    } else {
      try {
        groupIds = await this.socketService.getUserGroupIds(mentorId);
      } catch (err: any) {
        this.logger.warn(
          `Failed to fetch user group IDs for mentor ${mentorId}: ${err?.message}`,
        );
        groupIds = [];
      }
    }

    const orConditions: Record<string, any>[] = [];

    if (groupIds && groupIds.length > 0) {
      orConditions.push({ groupId: { $in: groupIds } });
      orConditions.push({ conversationId: { $in: groupIds.map((gid) => `group:${gid}`) } });
    }

    orConditions.push({ recipientId: mentorId });
    orConditions.push({ senderId: mentorId });
    orConditions.push({ conversationId: new RegExp(`(^|:)${mentorId}(:|$)`) });
    orConditions.push({ resolvedBy: mentorId });

    const baseFilter: Record<string, any> = {
      isDoubt: true,
      isDeleted: { $ne: true },
    };

    if (query?.all !== true && orConditions.length > 0) {
      baseFilter.$or = orConditions;
    }

    const filter: Record<string, any> = { ...baseFilter };

    const status = query?.status;
    if (status && status !== 'ALL') {
      filter.doubtStatus = status;
    }

    const openCountFilter = { ...baseFilter, doubtStatus: 'OPEN' };
    const resolvedCountFilter = { ...baseFilter, doubtStatus: 'RESOLVED' };

    const [openCount, resolvedCount] = await Promise.all([
      this.messageModel.countDocuments(openCountFilter),
      this.messageModel.countDocuments(resolvedCountFilter),
    ]);

    const totalDoubtCount = openCount + resolvedCount;

    let queryBuilder = this.messageModel
      .find(filter)
      .sort({ messageId: -1, timestamp: -1, createdAt: -1 });

    if (query?.limit !== undefined && query?.limit !== null) {
      const limit = typeof query.limit === 'number' ? query.limit : parseInt(String(query.limit), 10);
      if (!isNaN(limit) && limit > 0) {
        queryBuilder = queryBuilder.limit(limit);
        if (query?.page) {
          const page = typeof query.page === 'number' ? query.page : parseInt(String(query.page), 10);
          if (!isNaN(page) && page > 1) {
            queryBuilder = queryBuilder.skip((page - 1) * limit);
          }
        }
      }
    }

    const docs = await queryBuilder.lean().exec();

    const doubts: ChatMessageResponse[] = docs.map((d: any) =>
      formatMessageResponse(d),
    );

    return {
      totalDoubtCount,
      openCount,
      resolvedCount,
      doubts,
    };
  }
}
