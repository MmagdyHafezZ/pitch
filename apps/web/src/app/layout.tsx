import type { Metadata } from 'next'
import '@mantine/core/styles.css'
import { ColorSchemeScript, mantineHtmlProps } from '@mantine/core'
import { Providers } from '@/lib/providers'
import { AuthGate } from './auth-gate'

export const metadata: Metadata = {
  title: 'PITCH - Your Business Platform',
  description: 'A modern business management platform',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript />
      </head>
      <body>
        <Providers>
          <AuthGate>{children}</AuthGate>
        </Providers>
      </body>
    </html>
  )
}
