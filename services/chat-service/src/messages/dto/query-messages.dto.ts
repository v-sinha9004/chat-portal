import { IsOptional, IsString, IsNotEmpty, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryMessagesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  before?: string;

  @IsOptional()
  @IsString()
  after?: string;
}

export class QueryMessageContextDto {
  @IsString()
  @IsNotEmpty()
  messageId: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(50)
  surrounding?: number;
}

// Re-export DTOs and interfaces for seamless backward compatibility
export * from './pin-message.dto';
export * from './report-message.dto';
export * from './query-doubts.dto';
export * from '../interfaces/message-response.interface';
export * from '../interfaces/doubt-response.interface';
export * from '../interfaces/pin-response.interface';
export * from '../interfaces/report-response.interface';
