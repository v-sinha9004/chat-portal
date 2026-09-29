import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateGroupDto {
  @IsString()
  @IsNotEmpty({ message: 'Group name is required' })
  @MinLength(1, { message: 'Group name must be at least 1 character long' })
  @MaxLength(100, { message: 'Group name cannot exceed 100 characters' })
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Description cannot exceed 500 characters' })
  description?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsArray({ message: 'memberIds must be an array of user IDs' })
  @IsUUID('all', { each: true, message: 'Each memberId must be a valid UUID' })
  memberIds?: string[];
}
