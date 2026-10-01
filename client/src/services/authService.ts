import type {
  AuthResponse,
  LoginCredentials,
  RegisterCredentials,
  User,
} from '@/types';
import { apiClient } from '@/utils/httpClient';

const GATEWAY_URL = import.meta.env.VITE_API_GATEWAY_URL || '';
const REFRESH_TOKEN_STORAGE_KEY = 'chat_portal_refresh_token';

class AuthService {
  private baseUrl = `${GATEWAY_URL}/api/auth`;
  private refreshPromise: Promise<AuthResponse> | null = null;

  /**
   * Retrieves the locally stored refresh token (fallback for environments blocking 3rd party cookies).
   */
  getStoredRefreshToken(): string | null {
    try {
      return localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  /**
   * Saves or clears the local refresh token.
   */
  setStoredRefreshToken(token: string | null | undefined): void {
    try {
      if (token) {
        localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, token);
      } else {
        localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
      }
    } catch {
      // Ignore storage errors in restrictive environments
    }
  }

  /**
   * Login with email and password.
   * Transmits credentials: 'include' so server-set HttpOnly refresh token cookie is stored by browser,
   * and saves refreshToken in localStorage as a cross-site/incognito fallback.
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const res = await apiClient.post<AuthResponse>(`${this.baseUrl}/login`, credentials, {
      credentials: 'include',
    });
    if (res?.refreshToken) {
      this.setStoredRefreshToken(res.refreshToken);
    }
    return res;
  }

  /**
   * Register a new user account.
   */
  async register(data: RegisterCredentials): Promise<AuthResponse> {
    const res = await apiClient.post<AuthResponse>(`${this.baseUrl}/register`, data, {
      credentials: 'include',
    });
    if (res?.refreshToken) {
      this.setStoredRefreshToken(res.refreshToken);
    }
    return res;
  }

  /**
   * Refresh the access token using the browser's HttpOnly refresh cookie or local storage fallback.
   * Deduplicates concurrent refresh requests to prevent race conditions during React StrictMode.
   */
  async refresh(): Promise<AuthResponse> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const storedRefreshToken = this.getStoredRefreshToken();

    this.refreshPromise = (async () => {
      try {
        const res = await apiClient.post<AuthResponse>(
          `${this.baseUrl}/refresh`,
          storedRefreshToken ? { refreshToken: storedRefreshToken } : {},
          {
            credentials: 'include',
          },
        );
        if (res?.refreshToken) {
          this.setStoredRefreshToken(res.refreshToken);
        }
        return res;
      } catch (err) {
        // If the token was invalidated or expired, clear it
        this.setStoredRefreshToken(null);
        throw err;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  /**
   * Log out of active session and clear HttpOnly cookie and local storage.
   */
  async logout(): Promise<void> {
    const storedRefreshToken = this.getStoredRefreshToken();
    this.setStoredRefreshToken(null);

    try {
      await apiClient.post<void>(
        `${this.baseUrl}/logout`,
        storedRefreshToken ? { refreshToken: storedRefreshToken } : {},
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
