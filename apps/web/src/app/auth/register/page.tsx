import { Metadata } from 'next'
import { RegisterPageClient } from './RegisterPageClient'

export const metadata: Metadata = {
  title: 'Create Account | PITCH',
  description: 'Create your account and get started',
}

export default function RegisterPage() {
  return <RegisterPageClient />
}
