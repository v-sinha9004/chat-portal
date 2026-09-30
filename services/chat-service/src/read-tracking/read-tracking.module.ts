import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ConversationRead,
  ConversationReadSchema,
} from '../messages/schemas/conversation-read.schema';
import { ReadTrackingService } from './read-tracking.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ConversationRead.name, schema: ConversationReadSchema },
    ]),
  ],
  providers: [ReadTrackingService],
  exports: [ReadTrackingService],
})
export class ReadTrackingModule {}
