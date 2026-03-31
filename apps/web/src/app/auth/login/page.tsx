import { Metadata } from 'next'
import { formatPageTitle } from '@/lib/branding'
import { LoginPageClient } from './LoginPageClient'

export const metadata: Metadata = {
  title: formatPageTitle('Sign In'),
  description: 'Sign in to your account',
}

export default function LoginPage() {
  return <LoginPageClient />
}
