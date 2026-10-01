import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Message, MessageSchema } from './schemas/message.schema';
import {
  ConversationRead,
  ConversationReadSchema,
} from './schemas/conversation-read.schema';
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
import { SocketModule } from '../socket/socket.module';
import { ReadTrackingModule } from '../read-tracking/read-tracking.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
      { name: ConversationRead.name, schema: ConversationReadSchema },
      { name: PinnedMessage.name, schema: PinnedMessageSchema },
      { name: ReportedMessage.name, schema: ReportedMessageSchema },
    ]),
    forwardRef(() => SocketModule),
    ReadTrackingModule,
  ],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
