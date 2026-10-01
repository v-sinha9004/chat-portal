export type UserRole = 'ADMIN' | 'MENTOR' | 'MENTEE';

export interface User {
  id: string;
  email: string;
  username: string;
  name: string;
  role: 'ADMIN' | 'MENTEE' | 'MENTOR' | string;
  avatarUrl: string | null;
  bio: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UsersResponse {
  data: User[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole | string;
  name?: string;
  username?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
  user: {
    id: string;
    email: string;
    role: UserRole | string;
  };
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  username: string;
  name: string;
  role?: UserRole;
}
