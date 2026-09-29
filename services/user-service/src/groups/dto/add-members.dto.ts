import {
  IsArray,
  IsNotEmpty,
  IsUUID,
} from 'class-validator';

export class AddMembersDto {
  @IsArray({ message: 'userIds must be an array of user IDs' })
  @IsNotEmpty({ message: 'userIds array cannot be empty' })
  @IsUUID('all', { each: true, message: 'Each userId must be a valid UUID' })
  userIds!: string[];
}
