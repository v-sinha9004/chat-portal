import { GroupRole } from '@prisma/client';
import { SafeUser } from '../../users/interfaces/user-response.interface';

export interface GroupBase {
  id: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserGroupSummary extends GroupBase {
  myRole: GroupRole;
  memberCount: number;
}

export interface HydratedGroupMember {
  id: string;
  groupId: string;
  userId: string;
  role: GroupRole;
  joinedAt: Date;
  user: SafeUser | null;
}

export interface GroupDetails extends GroupBase {
  memberCount: number;
  members: HydratedGroupMember[];
}
