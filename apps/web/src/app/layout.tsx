import type { Metadata } from 'next'
import '@mantine/core/styles.css'
import { ColorSchemeScript, mantineHtmlProps } from '@mantine/core'
import { Providers } from '@/lib/providers'

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
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
