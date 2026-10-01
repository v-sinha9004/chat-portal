import { Role } from '@prisma/client';

export interface SafeUser {
  id: string;
  username: string;
  name: string | null;
  role: Role;
  avatarUrl: string | null;
  bio: string | null;
  isActive: boolean;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
