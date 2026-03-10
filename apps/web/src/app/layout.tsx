import type { Metadata, Viewport } from 'next'
import { Suspense } from 'react'
import '@mantine/core/styles.css'
import 'driver.js/dist/driver.css'
import { ColorSchemeScript, mantineHtmlProps } from '@mantine/core'
import { DEFAULT_LOCALE } from '@/features/i18n/constants'
import { Providers } from '@/lib/providers'
import { AuthGate } from './auth-gate'

export const metadata: Metadata = {
  title: 'PITCH - Your Business Platform',
  description: 'A modern business management platform',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang={DEFAULT_LOCALE} {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript />
      </head>
      <body>
        <Providers>
          <Suspense fallback={null}>
            <AuthGate>{children}</AuthGate>
          </Suspense>
        </Providers>
      </body>
    </html>
  )
}
