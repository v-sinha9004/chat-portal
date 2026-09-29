import {
  Controller,
  Get,
  Param,
  Query,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import {
  QueryMessagesDto,
  ConversationHistoryResponse,
} from './dto/query-messages.dto';

@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

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
}
