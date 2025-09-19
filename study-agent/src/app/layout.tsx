import './globals.css'
import type { Metadata } from 'next'
import React from 'react'
import ChatSidebar from '@/components/ChatSidebar'

export const metadata: Metadata = {
  title: 'Study Flow Agent',
  description: 'Planner + Chat Agent (Gemini)',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="flex h-screen">
          <aside className="w-[320px] border-r border-white/10 bg-black/20">
            <ChatSidebar />
          </aside>
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </body>
    </html>
  )
}
