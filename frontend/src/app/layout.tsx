import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TimeClock - Attendance System',
  description: 'VDO Intern Attendance & Time Tracking System',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-TW">
      <body>{children}</body>
    </html>
  )
}
