import { Prisma } from '@prisma/client';

export const USER_SAFE_SELECT: Prisma.UserSelect = {
  id: true,
  username: true,
  name: true,
  role: true,
  lastSeenAt: true,
};
