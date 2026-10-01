import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { SocketService } from '../socket.service';
import { MessagesService } from '../../messages/messages.service';
import {
  AuthenticatedSocket,
  UpdateDoubtStatusPayload,
  DeleteMessagePayload,
  DoubtStatusChangedEvent,
} from '../interfaces/socket-events.interface';

@Injectable()
export class SocketModerationService {
  private readonly logger = new Logger(SocketModerationService.name);

  constructor(
    private readonly socketService: SocketService,
    @Inject(forwardRef(() => MessagesService))
    private readonly messagesService: MessagesService,
  ) {}

  async handleUpdateDoubtStatus(
    client: AuthenticatedSocket,
    payload: UpdateDoubtStatusPayload,
  ) {
    const { conversationId, messageId, status } = payload || {};
    if (!conversationId || !messageId || !status || (status !== 'OPEN' && status !== 'RESOLVED')) {
      return {
        status: 'error',
        message: 'Invalid payload: conversationId, messageId, and status (OPEN | RESOLVED) are required',
      };
    }

    const senderId = client.data.userId;
    if (!senderId) {
      return { status: 'error', message: 'Unauthorized socket session' };
    }

    const userRole = (client.data.user?.role || '').toUpperCase();
    const userName = client.data.user?.name || client.data.user?.email || 'User';

    try {
      const updatedMessage = await this.messagesService.updateDoubtStatus(
        senderId,
        userRole,
        userName,
        conversationId,
        messageId,
        status,
      );

      const eventPayload: DoubtStatusChangedEvent = {
        conversationId,
        messageId,
        status: (updatedMessage.doubtStatus as 'OPEN' | 'RESOLVED') || status,
        resolvedBy: updatedMessage.resolvedBy,
        resolvedByName: updatedMessage.resolvedByName,
        resolvedAt: updatedMessage.resolvedAt,
      };

      if (conversationId.startsWith('direct:')) {
        const parts = conversationId.replace('direct:', '').split(':');
        this.socketService.emitToUsers(parts, 'doubt_status_changed', eventPayload);
      } else if (conversationId.startsWith('group:')) {
        const groupId = conversationId.replace('group:', '');
        const memberIds = await this.socketService.getGroupMemberIds(groupId);
        if (memberIds && memberIds.length > 0) {
          this.socketService.emitToUsers(memberIds, 'doubt_status_changed', eventPayload);
        }
      }

      return {
        status: 'ok',
        message: `Doubt marked as ${status}`,
        data: eventPayload,
      };
    } catch (err: any) {
      return {
        status: 'error',
        message: err.message || 'Failed to update doubt status',
      };
    }
  }

  async handleDeleteMessage(
    client: AuthenticatedSocket,
    payload: DeleteMessagePayload,
  ) {
    const { messageId } = payload || {};
    if (!messageId || typeof messageId !== 'string' || !messageId.trim()) {
      return { status: 'error', message: 'Invalid payload: messageId is required' };
    }

    const currentUserId = client.data.userId;
    if (!currentUserId) {
      return { status: 'error', message: 'Unauthorized socket session' };
    }

    const currentUserRole = client.data.user?.role || '';

    try {
      const result = await this.messagesService.deleteMessage(
        currentUserId,
        currentUserRole,
        messageId.trim(),
      );

      return {
        status: 'ok',
        message: result.message,
        messageId: result.messageId,
        conversationId: result.conversationId,
      };
    } catch (err: any) {
      return {
        status: 'error',
        message: err.message || 'Failed to delete message',
      };
    }
  }
}
