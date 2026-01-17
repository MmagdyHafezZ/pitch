import { Metadata } from 'next'
import { LoginPageClient } from './LoginPageClient'

export const metadata: Metadata = {
  title: 'Sign In | PITCH',
  description: 'Sign in to your account',
}

export default function LoginPage() {
  return <LoginPageClient />
}
