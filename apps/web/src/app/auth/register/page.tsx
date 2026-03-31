import { Metadata } from 'next'
import { formatPageTitle } from '@/lib/branding'
import { RegisterPageClient } from './RegisterPageClient'

export const metadata: Metadata = {
  title: formatPageTitle('Create Account'),
  description: 'Create your account and get started',
}

export default function RegisterPage() {
  return <RegisterPageClient />
}
