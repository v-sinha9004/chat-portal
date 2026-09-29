import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { AuthUser, LoginCredentials, RegisterCredentials } from '../types';
import { authService } from '../services/authService';

interface AuthContextType {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterCredentials) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  refreshSession: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Pure in-memory state: held exclusively in React RAM
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Session Hydration on Boot:
   * Checks the HttpOnly refresh token cookie on startup/F5 to restore in-memory access token.
   */
  useEffect(() => {
    let isMounted = true;

    async function hydrateSession() {
      try {
        const response = await authService.refresh();
        if (isMounted) {
          setAccessToken(response.accessToken);
          setUser(response.user);
          setIsAuthenticated(true);
          setError(null);
        }
      } catch {
        // Expected for logged-out or first-time visitors
        if (isMounted) {
          setAccessToken(null);
          setUser(null);
          setIsAuthenticated(false);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    hydrateSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authService.login(credentials);
      setAccessToken(response.accessToken);
      setUser(response.user);
      setIsAuthenticated(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (data: RegisterCredentials) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authService.register(data);
      setAccessToken(response.accessToken);
      setUser(response.user);
      setIsAuthenticated(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await authService.logout();
    } finally {
      // Clear in-memory state
      setAccessToken(null);
      setUser(null);
      setIsAuthenticated(false);
      setError(null);
      setIsLoading(false);
    }
  }, []);

  const refreshSession = useCallback(async (): Promise<string | null> => {
    try {
      const response = await authService.refresh();
      setAccessToken(response.accessToken);
      setUser(response.user);
      setIsAuthenticated(true);
      return response.accessToken;
    } catch {
      setAccessToken(null);
      setUser(null);
      setIsAuthenticated(false);
      return null;
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isAuthenticated,
        isLoading,
        error,
        login,
        register,
        logout,
        clearError,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
