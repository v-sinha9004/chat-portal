import { Module, forwardRef } from '@nestjs/common';
import { SocketGateway } from './socket.gateway';
import { SocketService } from './socket.service';
import { ChatQueueModule } from '../queue/chat-queue.module';
import { PresenceModule } from '../presence/presence.module';
import { ReadTrackingModule } from '../read-tracking/read-tracking.module';
import { MessagesModule } from '../messages/messages.module';

import { SocketMessagingService } from './services/socket-messaging.service';
import { SocketReadReceiptsService } from './services/socket-read-receipts.service';
import { SocketPresenceHandlerService } from './services/socket-presence-handler.service';
import { SocketModerationService } from './services/socket-moderation.service';

@Module({
  imports: [
    ChatQueueModule,
    PresenceModule,
    ReadTrackingModule,
    forwardRef(() => MessagesModule),
  ],
  providers: [
    SocketGateway,
    SocketService,
    SocketMessagingService,
    SocketReadReceiptsService,
    SocketPresenceHandlerService,
    SocketModerationService,
  ],
  exports: [
    SocketService,
    SocketMessagingService,
    SocketReadReceiptsService,
    SocketPresenceHandlerService,
    SocketModerationService,
  ],
})
export class SocketModule {}

