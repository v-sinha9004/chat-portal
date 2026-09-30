import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Headers,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UnauthorizedException,
} from '@nestjs/common';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { AddMembersDto } from './dto/add-members.dto';

@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  /**
   * Helper to ensure requester identity is present
   */
  private getAuthenticatedUserId(userIdHeader?: string): string {
    if (!userIdHeader) {
      throw new UnauthorizedException('Authentication required: missing user identity header');
    }
    return userIdHeader;
  }

  /**
   * Create a new group
   * POST /api/users/groups
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Headers('x-user-id') userIdHeader: string,
    @Body() createGroupDto: CreateGroupDto,
  ) {
    const userId = this.getAuthenticatedUserId(userIdHeader);
    return this.groupsService.create(userId, createGroupDto);
  }

  /**
   * List all groups for the current authenticated user
   * GET /api/users/groups
   */
  @Get()
  async findAllForUser(@Headers('x-user-id') userIdHeader: string) {
    const userId = this.getAuthenticatedUserId(userIdHeader);
    return this.groupsService.findAllForUser(userId);
  }

  /**
   * Fast internal endpoint for chat-service to fetch group member IDs
   * GET /api/users/groups/:id/member-ids
   */
  @Get(':id/member-ids')
  async getMemberIds(@Param('id', ParseUUIDPipe) id: string) {
    return this.groupsService.getMemberIds(id);
  }

  /**
   * Fast internal endpoint for chat-service to fetch user group IDs
   * GET /api/users/groups/user/:userId/group-ids
   */
  @Get('user/:userId/group-ids')
  async getUserGroupIds(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.groupsService.getUserGroupIds(userId);
  }

  /**
   * Get single group details with hydrated member profiles
   * GET /api/users/groups/:id
   */
  @Get(':id')
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-user-id') userIdHeader: string,
  ) {
    const userId = this.getAuthenticatedUserId(userIdHeader);
    return this.groupsService.findById(id, userId);
  }

  /**
   * Add new members to a group
   * POST /api/users/groups/:id/members
   */
  @Post(':id/members')
  async addMembers(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-user-id') userIdHeader: string,
    @Body() addMembersDto: AddMembersDto,
  ) {
    const userId = this.getAuthenticatedUserId(userIdHeader);
    return this.groupsService.addMembers(id, userId, addMembersDto);
  }

  /**
   * Remove a member or leave a group
   * DELETE /api/users/groups/:id/members/:userId
   */
  @Delete(':id/members/:userId')
  async removeMember(
    @Param('id', ParseUUIDPipe) groupId: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
    @Headers('x-user-id') userIdHeader: string,
  ) {
    const requesterId = this.getAuthenticatedUserId(userIdHeader);
    return this.groupsService.removeMember(groupId, requesterId, targetUserId);
  }
}
