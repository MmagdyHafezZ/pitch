import { Metadata } from 'next';
import { AuthPage } from '@/features/auth/components/AuthPage';

export const metadata: Metadata = {
  title: 'Sign In | PITCH',
  description: 'Sign in to your account',
};

export default function LoginPage() {
  return <AuthPage defaultMode="login" />;
}