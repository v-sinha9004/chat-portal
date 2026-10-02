import React, { useState } from 'react';
import { useAuthStore } from '@/store';

export interface LoginProps {
  onSwitchToRegister?: () => void;
}

export const Login: React.FC<LoginProps> = ({ onSwitchToRegister }) => {
  const login = useAuthStore((s) => s.login);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    if (!email.trim() || !password) {
      setLocalError('Please fill in all required fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login({ email: email.trim(), password });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setLocalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSwitchToRegister = () => {
    setLocalError(null);
    clearError();
    onSwitchToRegister?.();
  };

  const displayedError = localError || error;

  return (
    <div className="auth-page-wrapper">
      <div className="auth-card">
        {/* Brand / Logo Header */}
        <div className="auth-header">
          <div className="auth-logo-badge">
            <span className="auth-logo-icon">💬</span>
          </div>
          <h1 className="auth-title">Welcome Back</h1>
          <p className="auth-subtitle">
            Sign in to access your contacts and messages
          </p>
        </div>

        {/* Error Alert */}
        {displayedError && (
          <div className="auth-error-alert" role="alert">
            <span className="auth-error-icon">⚠️</span>
            <span className="auth-error-text">{displayedError}</span>
          </div>
        )}

        {/* Login Form */}
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="auth-field-group">
            <label htmlFor="auth-email" className="auth-label">
              Email Address
            </label>
            <input
              id="auth-email"
              type="email"
              className="auth-input"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              autoComplete="email"
              required
            />
          </div>

          <div className="auth-field-group">
            <div className="auth-label-row">
              <label htmlFor="auth-password" className="auth-label">
                Password
              </label>
            </div>
            <input
              id="auth-password"
              type="password"
              className="auth-input"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="auth-submit-loading">
                <span className="loading-spinner small" />
                Signing in...
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Bottom Toggle Text */}
        {onSwitchToRegister && (
          <div className="auth-footer-text">
            Don't have an account?{' '}
            <button
              type="button"
              className="auth-link-btn"
              onClick={handleSwitchToRegister}
              disabled={isSubmitting}
            >
              Sign up
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
