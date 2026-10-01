import { IsNotEmpty, IsString } from 'class-validator';

export class PinMessageDto {
  @IsString()
  @IsNotEmpty()
  conversationId: string;
}
