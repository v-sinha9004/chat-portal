import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { SocketService } from '../socket.service';
import { PresenceService } from '../../presence/presence.service';
import {
  AuthenticatedSocket,
  SubscribeUserPresencePayload,
  SubscribeGroupPresencePayload,
  TypingStartPayload,
  TypingStopPayload,
  UserTypingEvent,
  UserPresenceChangedEvent,
  GroupPresenceChangedEvent,
  getUserPresenceRoom,
  getGroupPresenceRoom,
} from '../interfaces/socket-events.interface';

@Injectable()
export class SocketPresenceHandlerService {
  private readonly logger = new Logger(SocketPresenceHandlerService.name);

  constructor(
    private readonly socketService: SocketService,
    private readonly presenceService: PresenceService,
  ) {}

  async handleSubscribeUserPresence(
    client: AuthenticatedSocket,
    payload: SubscribeUserPresencePayload,
  ) {
    const { targetUserId } = payload || {};
    if (!targetUserId) {
      return { status: 'error', message: 'targetUserId is required' };
    }
    const room = getUserPresenceRoom(targetUserId);
    client.join(room);

    const presence = await this.presenceService.getUserPresence(targetUserId);
    return {
      status: 'ok',
      ...presence,
    };
  }

  handleUnsubscribeUserPresence(
    client: AuthenticatedSocket,
    payload: SubscribeUserPresencePayload,
  ) {
    const { targetUserId } = payload || {};
    if (targetUserId) {
      client.leave(getUserPresenceRoom(targetUserId));
    }
    return { status: 'ok' };
  }

  async handleSubscribeGroupPresence(
    client: AuthenticatedSocket,
    payload: SubscribeGroupPresencePayload,
  ) {
    const { groupId } = payload || {};
    if (!groupId) {
      return { status: 'error', message: 'groupId is required' };
    }
    const room = getGroupPresenceRoom(groupId);
    client.join(room);

    const memberIds = await this.socketService.getGroupMemberIds(groupId);
    const presence = await this.presenceService.getGroupPresence(groupId, memberIds);
    return {
      status: 'ok',
      ...presence,
    };
  }

  handleUnsubscribeGroupPresence(
    client: AuthenticatedSocket,
    payload: SubscribeGroupPresencePayload,
  ) {
    const { groupId } = payload || {};
    if (groupId) {
      client.leave(getGroupPresenceRoom(groupId));
    }
    return { status: 'ok' };
  }

  async handleUserLogout(server: Server, client: AuthenticatedSocket) {
    const userId = client.data.userId;
    if (userId) {
      this.logger.log(`Explicit logout received for user "${userId}" (Socket: ${client.id})`);
      await this.presenceService.removeSocket(
        userId,
        client.id,
        (lastSeen) => {
          const presenceEvent: UserPresenceChangedEvent = {
            userId,
            isOnline: false,
            lastSeen,
          };
          server.to(getUserPresenceRoom(userId)).emit('user_presence_changed', presenceEvent);

          this.socketService
            .getUserGroupIds(userId)
            .then((groupIds) => {
              for (const groupId of groupIds) {
                const groupEvent: GroupPresenceChangedEvent = {
                  groupId,
                  userId,
                  isOnline: false,
                };
                server
                  .to(getGroupPresenceRoom(groupId))
                  .emit('group_presence_changed', groupEvent);
              }
            })
            .catch((err) => {
              this.logger.warn(
                `Could not emit group offline presence on logout for user ${userId}: ${err.message}`,
              );
            });
        },
        true,
      );
    }
    return { status: 'ok' };
  }

  handleTypingStart(
    client: AuthenticatedSocket,
    payload: TypingStartPayload,
  ) {
    const senderId = client.data.userId;
    if (!senderId) return { status: 'error', message: 'Unauthorized' };

    const { recipientId, groupId } = payload || {};
    const eventPayload: UserTypingEvent = {
      userId: senderId,
      isTyping: true,
      ...(recipientId ? { recipientId } : {}),
      ...(groupId ? { groupId } : {}),
    };

    if (recipientId) {
      this.socketService.emitToUser(recipientId, 'user_typing', eventPayload);
    } else if (groupId) {
      client.to(getGroupPresenceRoom(groupId)).emit('user_typing', eventPayload);
    }

    return { status: 'ok' };
  }

  handleTypingStop(
    client: AuthenticatedSocket,
    payload: TypingStopPayload,
  ) {
    const senderId = client.data.userId;
    if (!senderId) return { status: 'error', message: 'Unauthorized' };

    const { recipientId, groupId } = payload || {};
    const eventPayload: UserTypingEvent = {
      userId: senderId,
      isTyping: false,
      ...(recipientId ? { recipientId } : {}),
      ...(groupId ? { groupId } : {}),
    };

    if (recipientId) {
      this.socketService.emitToUser(recipientId, 'user_typing', eventPayload);
    } else if (groupId) {
      client.to(getGroupPresenceRoom(groupId)).emit('user_typing', eventPayload);
    }

    return { status: 'ok' };
  }
}
