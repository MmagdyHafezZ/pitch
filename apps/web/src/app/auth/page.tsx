import { Metadata } from 'next';
import { AuthPage } from '@/features/auth/components/AuthPage';

export const metadata: Metadata = {
  title: 'Authentication | PITCH',
  description: 'Sign in to your account or create a new one',
};

export default function AuthPageRoute() {
  return <AuthPage />;
}