import type {
  AuthResponse,
  LoginCredentials,
  RegisterCredentials,
  User,
} from '@/types';
import { apiClient } from '@/utils/httpClient';

const GATEWAY_URL = import.meta.env.VITE_API_GATEWAY_URL || '';

class AuthService {
  private baseUrl = `${GATEWAY_URL}/api/auth`;
  private refreshPromise: Promise<AuthResponse> | null = null;

  /**
   * Login with email and password.
   * Transmits credentials: 'include' so server-set HttpOnly refresh token cookie is stored by browser.
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>(`${this.baseUrl}/login`, credentials, {
      credentials: 'include',
    });
  }

  /**
   * Register a new user account.
   */
  async register(data: RegisterCredentials): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>(`${this.baseUrl}/register`, data, {
      credentials: 'include',
    });
  }

  /**
   * Refresh the access token using the browser's HttpOnly refresh cookie.
   * Deduplicates concurrent refresh requests to prevent race conditions during React StrictMode.
   */
  async refresh(): Promise<AuthResponse> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        return await apiClient.post<AuthResponse>(
          `${this.baseUrl}/refresh`,
          {},
          {
            credentials: 'include',
          },
        );
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  /**
   * Log out of active session and clear HttpOnly cookie on backend.
   */
  async logout(): Promise<void> {
    try {
      await apiClient.post<void>(
        `${this.baseUrl}/logout`,
        {},
        {
          credentials: 'include',
        },
      );
    } catch (err) {
      console.warn('Logout network call failed, clearing local state anyway:', err);
    }
  }

  /**
   * Fetch current authenticated user's profile details.
   */
  async getMe(accessToken: string): Promise<User> {
    return apiClient.get<User>(`${this.baseUrl}/me`, {
      token: accessToken,
      credentials: 'include',
    });
  }
}

export const authService = new AuthService();
