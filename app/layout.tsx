import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/lib/providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'MedContractHub - Win More Federal Medical Supply Contracts',
  description: 'AI-powered platform to help medical supply companies discover, analyze, and win federal contracts through SAM.gov integration.',
}

interface IRootLayoutProps {
  children: React.ReactNode
}

export default function RootLayout({
  children,
}: IRootLayoutProps) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}