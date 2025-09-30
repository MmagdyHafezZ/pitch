import type { Metadata } from 'next'
import { Providers, ColorSchemeScript } from '@/lib/providers'

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
    <html lang="en">
      <head>
        <ColorSchemeScript />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
