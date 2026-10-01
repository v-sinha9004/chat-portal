import { Injectable, Logger } from '@nestjs/common';
import { requestJson } from '../common/utils/http.util';

export interface UserServiceUser {
  id: string;
  name?: string;
  username?: string;
  email?: string;
  role?: string;
  lastSeenAt?: string;
}

@Injectable()
export class UserServiceClient {
  private readonly logger = new Logger(UserServiceClient.name);

  private get baseUrl(): string {
    return process.env.USER_SERVICE_URL || 'http://localhost:3002';
  }

  /**
   * Fetches user profile/details by user ID.
   */
  async getUserById(userId: string): Promise<UserServiceUser | null> {
    if (!userId) return null;
    const url = `${this.baseUrl}/api/users/${encodeURIComponent(userId)}`;
    try {
      return await requestJson<UserServiceUser>(url, { method: 'GET', timeoutMs: 4000 });
    } catch (err: any) {
      this.logger.warn(`Failed to fetch user ${userId}: ${err.message}`);
      return null;
    }
  }

  /**
   * Batch-fetches display names (name or username) for a list of user IDs.
   */
  async getUserNamesMap(userIds: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));

    await Promise.all(
      uniqueIds.map(async (userId) => {
        const user = await this.getUserById(userId);
        if (user) {
          const displayName = user.name || user.username;
          if (displayName) {
            map.set(userId, displayName);
          }
        }
      }),
    );

    return map;
  }

  /**
   * Checks if a user has the MENTOR role in user-service.
   */
  async checkIsMentor(userId: string): Promise<boolean> {
    if (!userId) return false;
    const user = await this.getUserById(userId);
    return (user?.role || '').toUpperCase() === 'MENTOR';
  }

  /**
   * Fetches member IDs for a given group.
   */
  async getGroupMemberIds(groupId: string): Promise<string[]> {
    if (!groupId) return [];
    const url = `${this.baseUrl}/api/users/groups/${encodeURIComponent(groupId)}/member-ids`;
    try {
      const data = await requestJson<{ groupId: string; memberIds: string[] }>(url, {
        method: 'GET',
        timeoutMs: 4000,
      });
      return data?.memberIds || [];
    } catch (err: any) {
      this.logger.error(`Failed to fetch group members for ${groupId}: ${err.message}`);
      return [];
    }
  }

  /**
   * Fetches group IDs that a user belongs to.
   */
  async getUserGroupIds(userId: string): Promise<string[]> {
    if (!userId) return [];
    const url = `${this.baseUrl}/api/users/groups/user/${encodeURIComponent(userId)}/group-ids`;
    try {
      const data = await requestJson<{ userId: string; groupIds: string[] }>(url, {
        method: 'GET',
        timeoutMs: 4000,
      });
      return data?.groupIds || [];
    } catch (err: any) {
      this.logger.error(`Failed to fetch group IDs for user ${userId}: ${err.message}`);
      return [];
    }
  }

  /**
   * Updates a user's lastSeenAt timestamp in user-service (PostgreSQL).
   */
  async updateLastSeen(userId: string, lastSeenAt: string): Promise<boolean> {
    if (!userId) return false;
    const url = `${this.baseUrl}/api/users/${encodeURIComponent(userId)}/last-seen`;
    try {
      await requestJson(url, {
        method: 'PATCH',
        body: JSON.stringify({ lastSeenAt }),
        timeoutMs: 3000,
      });
      return true;
    } catch (err: any) {
      this.logger.warn(`Failed to update last-seen for user ${userId}: ${err.message}`);
      return false;
    }
  }
}
