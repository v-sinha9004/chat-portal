import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { GroupRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { USER_SAFE_SELECT } from '../users/users.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { AddMembersDto } from './dto/add-members.dto';

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new group.
   * The creator is automatically added as an ADMIN.
   * Any additional memberIds are added as MEMBERs.
   */
  async create(creatorId: string, dto: CreateGroupDto) {
    if (!creatorId) {
      throw new BadRequestException('Creator ID is required');
    }

    // Verify creator exists
    const creator = await this.prisma.user.findUnique({
      where: { id: creatorId },
    });
    if (!creator) {
      throw new NotFoundException(`Creator user with ID '${creatorId}' not found`);
    }

    const uniqueMemberIds = Array.from(
      new Set((dto.memberIds || []).filter((id) => id && id !== creatorId)),
    );

    return this.prisma.$transaction(async (tx) => {
      // 1. Create group metadata
      const group = await tx.group.create({
        data: {
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          avatarUrl: dto.avatarUrl || null,
          createdById: creatorId,
        },
      });

      // 2. Add creator as ADMIN
      await tx.groupMember.create({
        data: {
          groupId: group.id,
          userId: creatorId,
          role: GroupRole.ADMIN,
        },
      });

      // 3. Add other members as MEMBER
      if (uniqueMemberIds.length > 0) {
        await tx.groupMember.createMany({
          data: uniqueMemberIds.map((userId) => ({
            groupId: group.id,
            userId,
            role: GroupRole.MEMBER,
          })),
          skipDuplicates: true,
        });
      }

      return {
        ...group,
        memberCount: 1 + uniqueMemberIds.length,
      };
    });
  }

  /**
   * List all groups the requesting user belongs to.
   */
  async findAllForUser(userId: string) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    const memberships = await this.prisma.groupMember.findMany({
      where: { userId },
      select: { groupId: true, role: true },
    });

    if (memberships.length === 0) {
      return [];
    }

    const groupIds = memberships.map((m) => m.groupId);

    const [groups, memberCounts] = await Promise.all([
      this.prisma.group.findMany({
        where: { id: { in: groupIds } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.groupMember.groupBy({
        by: ['groupId'],
        where: { groupId: { in: groupIds } },
        _count: { userId: true },
      }),
    ]);

    const countMap = new Map(memberCounts.map((c) => [c.groupId, c._count.userId]));
    const roleMap = new Map(memberships.map((m) => [m.groupId, m.role]));

    return groups.map((g) => ({
      ...g,
      myRole: roleMap.get(g.id) || GroupRole.MEMBER,
      memberCount: countMap.get(g.id) || 1,
    }));
  }

  /**
   * Get single group details with hydrated member profiles.
   * Throws ForbiddenException if requester is not a member of the group.
   */
  async findById(groupId: string, userId: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
    });
    if (!group) {
      throw new NotFoundException(`Group with ID '${groupId}' not found`);
    }

    const members = await this.prisma.groupMember.findMany({
      where: { groupId },
      orderBy: { joinedAt: 'asc' },
    });

    const isMember = members.some((m) => m.userId === userId);
    if (!isMember) {
      throw new ForbiddenException('You are not a member of this group');
    }

    // Hydrate user profile data for all members
    const memberUserIds = members.map((m) => m.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: memberUserIds } },
      select: USER_SAFE_SELECT,
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const hydratedMembers = members.map((m) => ({
      id: m.id,
      groupId: m.groupId,
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt,
      user: userMap.get(m.userId) || null,
    }));

    return {
      ...group,
      memberCount: members.length,
      members: hydratedMembers,
    };
  }

  /**
   * Add members to a group.
   * Requires requester to be a member of the group.
   */
  async addMembers(groupId: string, requesterId: string, dto: AddMembersDto) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
    });
    if (!group) {
      throw new NotFoundException(`Group with ID '${groupId}' not found`);
    }

    // Verify requester is a member
    const requesterMember = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: requesterId } },
    });
    if (!requesterMember) {
      throw new ForbiddenException('You must be a member of this group to add users');
    }

    const existingMembers = await this.prisma.groupMember.findMany({
      where: { groupId },
      select: { userId: true },
    });
    const existingSet = new Set(existingMembers.map((m) => m.userId));

    const newMemberIds = Array.from(new Set(dto.userIds)).filter(
      (id) => id && !existingSet.has(id),
    );

    if (newMemberIds.length > 0) {
      await this.prisma.groupMember.createMany({
        data: newMemberIds.map((userId) => ({
          groupId,
          userId,
          role: GroupRole.MEMBER,
        })),
        skipDuplicates: true,
      });
    }

    return this.findById(groupId, requesterId);
  }

  /**
   * Remove a member or leave a group.
   * If requesterId === targetUserId, the member is leaving.
   * Otherwise, requester must be an ADMIN of the group.
   */
  async removeMember(groupId: string, requesterId: string, targetUserId: string) {
    const targetMember = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: targetUserId } },
    });
    if (!targetMember) {
      throw new NotFoundException('Member not found in this group');
    }

    if (requesterId !== targetUserId) {
      const requesterMember = await this.prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId: requesterId } },
      });
      if (!requesterMember || requesterMember.role !== GroupRole.ADMIN) {
        throw new ForbiddenException('Only group admins can remove other members');
      }
    }

    await this.prisma.groupMember.delete({
      where: { groupId_userId: { groupId, userId: targetUserId } },
    });

    return {
      success: true,
      message:
        requesterId === targetUserId
          ? 'You have left the group'
          : 'Member has been removed from the group',
    };
  }

  /**
   * High-speed member IDs lookup endpoint for chat-service.
   * Returns { groupId, memberIds: string[] } with zero join overhead.
   */
  async getMemberIds(groupId: string) {
    const members = await this.prisma.groupMember.findMany({
      where: { groupId },
      select: { userId: true },
    });

    return {
      groupId,
      memberIds: members.map((m) => m.userId),
    };
  }

  /**
   * High-speed group IDs lookup endpoint for chat-service.
   * Returns { userId, groupIds: string[] } for presence notifications.
   */
  async getUserGroupIds(userId: string) {
    const memberships = await this.prisma.groupMember.findMany({
      where: { userId },
      select: { groupId: true },
    });

    return {
      userId,
      groupIds: memberships.map((m) => m.groupId),
    };
  }

  /**
   * Delete a group.
   * Only the group creator or a group ADMIN is allowed to delete the group.
   * Cascades deletion of all GroupMember records and the Group record.
   */
  async deleteGroup(groupId: string, requesterId: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
    });
    if (!group) {
      throw new NotFoundException(`Group with ID '${groupId}' not found`);
    }

    const requesterMember = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: requesterId } },
    });

    const isCreator = group.createdById === requesterId;
    const isAdmin = requesterMember?.role === GroupRole.ADMIN;

    if (!isCreator && !isAdmin) {
      throw new ForbiddenException('Only the group creator or an admin can delete this group');
    }

    await this.prisma.$transaction(async (tx) => {
      // 1. Remove all group members
      await tx.groupMember.deleteMany({
        where: { groupId },
      });

      // 2. Remove group record
      await tx.group.delete({
        where: { id: groupId },
      });
    });

    return {
      success: true,
      message: 'Group deleted successfully',
      groupId,
    };
  }
}

