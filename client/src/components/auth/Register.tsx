import React, { useState } from 'react';
import { useAuthStore } from '@/store';
import type { UserRole } from '@/types';

export interface RegisterProps {
  onSwitchToLogin?: () => void;
}

export const Register: React.FC<RegisterProps> = ({ onSwitchToLogin }) => {
  const register = useAuthStore((s) => s.register);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);
  const [name, setName] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [role, setRole] = useState<UserRole>('MENTEE');
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

    if (!name.trim()) {
      setLocalError('Full name is required.');
      return;
    }
    if (!username.trim() || username.length < 3) {
      setLocalError('Username must be at least 3 characters long.');
      return;
    }
    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      await register({
        email: email.trim(),
        password,
        name: name.trim(),
        username: username.trim(),
        role,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setLocalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSwitchToLogin = () => {
    setLocalError(null);
    clearError();
    onSwitchToLogin?.();
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
          <h1 className="auth-title">Create an Account</h1>
          <p className="auth-subtitle">
            Sign up to start chatting on Chat Portal
          </p>
        </div>

        {/* Error Alert */}
        {displayedError && (
          <div className="auth-error-alert" role="alert">
            <span className="auth-error-icon">⚠️</span>
            <span className="auth-error-text">{displayedError}</span>
          </div>
        )}

        {/* Register Form */}
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="auth-field-group">
            <label htmlFor="auth-name" className="auth-label">
              Full Name
            </label>
            <input
              id="auth-name"
              type="text"
              className="auth-input"
              placeholder="e.g. Jane Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="auth-field-group">
            <label htmlFor="auth-username" className="auth-label">
              Username
            </label>
            <input
              id="auth-username"
              type="text"
              className="auth-input"
              placeholder="e.g. janedoe"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

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
              <span className="auth-label-hint">Min. 8 characters</span>
            </div>
            <input
              id="auth-password"
              type="password"
              className="auth-input"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              autoComplete="new-password"
              required
            />
          </div>

          <div className="auth-field-group">
            <label className="auth-label">Select Your Role</label>
            <div className="auth-role-selector">
              {(['MENTEE', 'MENTOR', 'ADMIN'] as UserRole[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`auth-role-pill ${role === r ? 'active' : ''}`}
                  onClick={() => setRole(r)}
                  disabled={isSubmitting}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="auth-submit-loading">
                <span className="loading-spinner small" />
                Creating account...
              </span>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        {/* Bottom Toggle Text */}
        {onSwitchToLogin && (
          <div className="auth-footer-text">
            Already have an account?{' '}
            <button
              type="button"
              className="auth-link-btn"
              onClick={handleSwitchToLogin}
              disabled={isSubmitting}
            >
              Sign in
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
