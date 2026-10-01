import { Role } from '@prisma/client';

export interface SafeUser {
  id: string;
  email: string;
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

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedUsersResponse {
  data: SafeUser[];
  meta: PaginationMeta;
}
