import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Message, MessageSchema } from './schemas/message.schema';
import {
  PinnedMessage,
  PinnedMessageSchema,
} from './schemas/pinned-message.schema';
import {
  ReportedMessage,
  ReportedMessageSchema,
} from './schemas/reported-message.schema';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { MessagesHistoryService } from './services/messages-history.service';
import { DoubtsService } from './services/doubts.service';
import { PinsService } from './services/pins.service';
import { ReportsService } from './services/reports.service';
import { SocketModule } from '../socket/socket.module';
import { ReadTrackingModule } from '../read-tracking/read-tracking.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
      { name: PinnedMessage.name, schema: PinnedMessageSchema },
      { name: ReportedMessage.name, schema: ReportedMessageSchema },
    ]),
    forwardRef(() => SocketModule),
    ReadTrackingModule,
  ],
  controllers: [MessagesController],
  providers: [
    MessagesHistoryService,
    DoubtsService,
    PinsService,
    ReportsService,
    MessagesService,
  ],
  exports: [
    MessagesHistoryService,
    DoubtsService,
    PinsService,
    ReportsService,
    MessagesService,
  ],
})
export class MessagesModule {}
