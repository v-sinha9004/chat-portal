import type {
  AuthResponse,
  LoginCredentials,
  RegisterCredentials,
  User,
} from '@/types';

const GATEWAY_URL = import.meta.env.VITE_API_GATEWAY_URL || '';

class AuthService {
  private baseUrl = `${GATEWAY_URL}/api/auth`;
  private refreshPromise: Promise<AuthResponse> | null = null;

  /**
   * Helper to format standardized error messages from API responses.
   */
  private async parseError(response: Response, defaultMessage: string): Promise<Error> {
    try {
      const data = await response.json();
      const message = Array.isArray(data?.message)
        ? data.message.join(', ')
        : data?.message || defaultMessage;
      return new Error(message);
    } catch {
      return new Error(`${defaultMessage} (Status ${response.status})`);
    }
  }

  /**
   * Login with email and password.
   * Transmits credentials: 'include' so server-set HttpOnly refresh token cookie is stored by browser.
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await fetch(`${this.baseUrl}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      throw await this.parseError(response, 'Login failed');
    }

    return response.json();
  }

  /**
   * Register a new user account.
   */
  async register(data: RegisterCredentials): Promise<AuthResponse> {
    const response = await fetch(`${this.baseUrl}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw await this.parseError(response, 'Registration failed');
    }

    return response.json();
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
        const response = await fetch(`${this.baseUrl}/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({}),
        });

        if (!response.ok) {
          throw await this.parseError(response, 'Session expired');
        }

        return await response.json();
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
      await fetch(`${this.baseUrl}/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({}),
      });
    } catch (err) {
      console.warn('Logout network call failed, clearing local state anyway:', err);
    }
  }

  /**
   * Fetch current authenticated user's profile details.
   */
  async getMe(accessToken: string): Promise<User> {
    const response = await fetch(`${this.baseUrl}/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw await this.parseError(response, 'Failed to fetch user profile');
    }

    return response.json();
  }
}

export const authService = new AuthService();
