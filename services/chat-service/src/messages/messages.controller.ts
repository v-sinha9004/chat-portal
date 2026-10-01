import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { ReadTrackingService } from '../read-tracking/read-tracking.service';
import {
  QueryMessagesDto,
  ConversationHistoryResponse,
  ChatMessageResponse,
  QueryMessageContextDto,
  MessageContextResponse,
  QueryDoubtsDto,
  DoubtsListResponse,
  PinnedMessageResponse,
  PinMessageDto,
  ReportMessageDto,
  QueryReportsDto,
  ReportsListResponse,
} from './dto/query-messages.dto';

@Controller('messages')
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly readTrackingService: ReadTrackingService,
  ) {}

  /**
   * Fetch real-time unread message counts for all conversations for authenticated user.
   * GET /api/chat/messages/unread-counts
   */
  @Get('unread-counts')
  async getUnreadCounts(
    @Headers('x-user-id') currentUserId: string,
  ): Promise<{ status: string; unreadCounts: Record<string, number> }> {
    if (!currentUserId) {
      throw new UnauthorizedException('Missing x-user-id header');
    }
    const unreadCounts =
      await this.readTrackingService.getUnreadCounts(currentUserId);
    return {
      status: 'ok',
      unreadCounts,
    };
  }

  /**
   * Fetch a slice of messages surrounding a specific target messageId (for replies, pins, search jumps).
   * GET /api/chat/messages/context?messageId=xxx&surrounding=25
   */
  @Get('context')
  async getMessageContext(
    @Headers('x-user-id') currentUserId: string,
    @Query() query: QueryMessageContextDto,
  ): Promise<MessageContextResponse> {
    if (!currentUserId) {
      throw new UnauthorizedException('Missing x-user-id header');
    }
    return this.messagesService.getMessageContext(currentUserId, query);
  }

  /**
   * Fetch past direct messages between authenticated user and specified user.
   * GET /api/chat/messages/direct/:userId
   */
  @Get('direct/:userId')
  async getDirectMessages(
    @Headers('x-user-id') currentUserId: string,
    @Param('userId') targetUserId: string,
    @Query() query: QueryMessagesDto,
  ): Promise<ConversationHistoryResponse> {
    if (!currentUserId) {
      throw new UnauthorizedException('Missing x-user-id header');
    }
    return this.messagesService.getDirectMessages(
      currentUserId,
      targetUserId,
      query,
    );
  }

  /**
   * Fetch past group messages for a group where the user is an active member.
   * GET /api/chat/messages/group/:groupId
   */
  @Get('group/:groupId')
  async getGroupMessages(
    @Headers('x-user-id') currentUserId: string,
    @Param('groupId') groupId: string,
    @Query() query: QueryMessagesDto,
  ): Promise<ConversationHistoryResponse> {
    if (!currentUserId) {
      throw new UnauthorizedException('Missing x-user-id header');
    }
    return this.messagesService.getGroupMessages(
      groupId,
      currentUserId,
      query,
    );
  }

  /**
   * Fetch doubts for a specific conversation (open/resolved/all).
   * GET /api/chat/messages/doubts?conversationId=xxx&status=OPEN
   */
  @Get('doubts')
  async getDoubts(
    @Headers('x-user-id') currentUserId: string,
    @Query() query: QueryDoubtsDto,
  ): Promise<DoubtsListResponse> {
    if (!currentUserId) {
      throw new UnauthorizedException('Missing x-user-id header');
    }
    return this.messagesService.getDoubts(currentUserId, query);
  }

  /**
   * Update doubt status (OPEN or RESOLVED).
   * PATCH /api/chat/messages/:messageId/doubt-status
   */
  @Patch(':messageId/doubt-status')
  async updateDoubtStatus(
    @Headers('x-user-id') currentUserId: string,
    @Headers('x-user-role') currentUserRole: string,
    @Headers('x-user-name') currentUserName: string,
    @Param('messageId') messageId: string,
    @Body() body: { conversationId: string; status: 'OPEN' | 'RESOLVED' },
  ): Promise<ChatMessageResponse> {
    if (!currentUserId) {
      throw new UnauthorizedException('Missing x-user-id header');
    }
    return this.messagesService.updateDoubtStatus(
      currentUserId,
      currentUserRole || '',
      currentUserName || '',
      body?.conversationId,
      messageId,
      body?.status,
    );
  }

  /**
   * Fetch active pinned messages for a conversation.
   * GET /api/chat/messages/pins?conversationId=xxx
   */
  @Get('pins')
  async getPinnedMessages(
    @Headers('x-user-id') currentUserId: string,
    @Query('conversationId') conversationId: string,
  ): Promise<PinnedMessageResponse[]> {
    if (!currentUserId) {
      throw new UnauthorizedException('Missing x-user-id header');
    }
    return this.messagesService.getPinnedMessages(currentUserId, conversationId);
  }

  /**
   * Pin a message in a conversation.
   * POST /api/chat/messages/:messageId/pin
   */
  @Post(':messageId/pin')
  async pinMessage(
    @Headers('x-user-id') currentUserId: string,
    @Headers('x-user-role') currentUserRole: string,
    @Headers('x-user-name') currentUserName: string,
    @Param('messageId') messageId: string,
    @Body() body: PinMessageDto,
  ): Promise<PinnedMessageResponse> {
    if (!currentUserId) {
      throw new UnauthorizedException('Missing x-user-id header');
    }
    return this.messagesService.pinMessage(
      currentUserId,
      currentUserRole || '',
      currentUserName || '',
      body?.conversationId,
      messageId,
    );
  }

  /**
   * Unpin a message in a conversation.
   * DELETE /api/chat/messages/:messageId/pin?conversationId=xxx
   */
  @Delete(':messageId/pin')
  async unpinMessage(
    @Headers('x-user-id') currentUserId: string,
    @Headers('x-user-role') currentUserRole: string,
    @Param('messageId') messageId: string,
    @Query('conversationId') conversationIdQuery?: string,
    @Body('conversationId') conversationIdBody?: string,
  ): Promise<{ success: boolean; conversationId: string; messageId: string }> {
    if (!currentUserId) {
      throw new UnauthorizedException('Missing x-user-id header');
    }
    const conversationId = conversationIdQuery || conversationIdBody || '';
    return this.messagesService.unpinMessage(
      currentUserId,
      currentUserRole || '',
      conversationId,
      messageId,
    );
  }

  /**
   * Fetch all reported messages (ADMIN only).
   * GET /api/chat/messages/reports
   */
  @Get('reports')
  async getReportedMessages(
    @Headers('x-user-id') currentUserId: string,
    @Headers('x-user-role') currentUserRole: string,
    @Query() query: QueryReportsDto,
  ): Promise<ReportsListResponse> {
    if (!currentUserId) {
      throw new UnauthorizedException('Missing x-user-id header');
    }
    return this.messagesService.getReportedMessages(
      currentUserId,
      currentUserRole || '',
      query,
    );
  }

  /**
   * Report a message.
   * POST /api/chat/messages/:messageId/report
   */
  @Post(':messageId/report')
  async reportMessage(
    @Headers('x-user-id') currentUserId: string,
    @Param('messageId') messageId: string,
    @Body() body: ReportMessageDto,
  ): Promise<{ status: string; message: string; reportId: string }> {
    if (!currentUserId) {
      throw new UnauthorizedException('Missing x-user-id header');
    }
    return this.messagesService.reportMessage(
      currentUserId,
      messageId,
      body,
    );
  }
}

