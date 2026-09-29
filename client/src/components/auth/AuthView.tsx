import React, { useState } from 'react';
import { Login } from './Login';
import { Register } from './Register';

export interface AuthViewProps {
  initialMode?: 'login' | 'register';
}

export const AuthView: React.FC<AuthViewProps> = ({ initialMode = 'login' }) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);

  if (mode === 'register') {
    return <Register onSwitchToLogin={() => setMode('login')} />;
  }

  return <Login onSwitchToRegister={() => setMode('register')} />;
};

export { Login } from './Login';
export { Register } from './Register';
