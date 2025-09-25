import { Metadata } from 'next'
import { AuthPage } from '@/features/auth/components/AuthPage'

export const metadata: Metadata = {
  title: 'Create Account | PITCH',
  description: 'Create your account and get started',
}

export default function RegisterPage() {
  return <AuthPage defaultMode="register" />
}
