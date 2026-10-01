import { Role } from '@prisma/client';

export interface SafeUser {
  id: string;
  username: string;
  name: string | null;
  role: Role;
  lastSeenAt: Date | null;
}
