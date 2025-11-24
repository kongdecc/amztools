import type { ReactNode } from 'react'
import './globals.css'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body suppressHydrationWarning={true}>{children}</body>
    </html>
  )
}