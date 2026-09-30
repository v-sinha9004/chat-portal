import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Message, MessageSchema } from './schemas/message.schema';
import {
  ConversationRead,
  ConversationReadSchema,
} from './schemas/conversation-read.schema';
import { MessagesService } from './messages.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
      { name: ConversationRead.name, schema: ConversationReadSchema },
    ]),
  ],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
