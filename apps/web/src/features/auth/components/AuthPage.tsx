'use client';

import { useState } from 'react';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';

interface AuthPageProps {
  defaultMode?: 'login' | 'register';
  onSuccess?: () => void;
}

export function AuthPage({ defaultMode = 'login', onSuccess }: AuthPageProps) {
  const [mode, setMode] = useState<'login' | 'register'>(defaultMode);

  const switchToLogin = () => setMode('login');
  const switchToRegister = () => setMode('register');

  if (mode === 'register') {
    return (
      <RegisterForm
        onSwitchToLogin={switchToLogin}
        onSuccess={onSuccess}
      />
    );
  }

  return (
    <LoginForm
      onSwitchToRegister={switchToRegister}
      onSuccess={onSuccess}
    />
  );
}