import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Headers,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Create a new user (called by auth-service on registration)
   * POST /api/users
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  /**
   * List all users
   * GET /api/users
   * If requester is a mentee, excludes other mentees.
   */
  @Get()
  async findAll(
    @Headers('x-user-role') requesterRole?: string,
    @Headers('x-user-id') requesterId?: string,
  ) {
    return this.usersService.findAll(requesterRole, requesterId);
  }

  /**
   * Get user by ID (consumed by chat-service)
   * GET /api/users/:id
   */
  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findById(id);
  }

  /**
   * Update user last seen timestamp (consumed by chat-service presence sync)
   * PATCH /api/users/:id/last-seen
   */
  @Patch(':id/last-seen')
  async updateLastSeen(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('lastSeenAt') lastSeenAt?: string,
  ) {
    const timestamp = lastSeenAt ? new Date(lastSeenAt) : new Date();
    return this.usersService.updateLastSeen(id, timestamp);
  }
}
