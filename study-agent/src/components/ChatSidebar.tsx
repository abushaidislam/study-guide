"use client"

import React, { useEffect, useRef, useState } from 'react'

type ChatMsg = { id: string; role: 'user' | 'assistant' | 'system'; content: string; createdAt: string }

type PlanEventDetail = {
  day?: 'today' | 'tomorrow'
  focusLabel?: string | null
  focusRaw?: string | null
  focusApplied?: boolean
  didUpdate?: boolean
  hadMatches?: boolean
}

type PlanRegeneratedEvent = CustomEvent<PlanEventDetail>

declare global {
  interface WindowEventMap {
    'plan:regenerated': PlanRegeneratedEvent
  }
}

export default function ChatSidebar() {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/chat')
      .then((res) => res.json())
      .then((data) => setMessages(data.messages || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) return
    const text = input.trim()
    setInput('')
    setLoading(true)
    const optimistic: ChatMsg = {
      id: Math.random().toString(36).slice(2),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })

      if (!res.ok) {
        throw new Error('chat_failed')
      }

      const data = await res.json()
      if (data.reply) {
        setMessages((prev) => [
          ...prev,
          {
            id: data.id || Math.random().toString(36).slice(2),
            role: 'assistant',
            content: data.reply,
            createdAt: new Date().toISOString(),
          },
        ])
      }

      if (data.planGenerated && typeof window !== 'undefined') {
        const detail: PlanEventDetail = {
          day: data.planDay === 'tomorrow' ? 'tomorrow' : 'today',
          focusLabel: data.planFocusLabel ?? null,
          focusRaw: data.planFocusRaw ?? null,
          focusApplied: Boolean(data.planFocusApplied),
          didUpdate: Boolean(data.planDidUpdate),
          hadMatches: data.planHadMatches ?? true,
        }
        window.dispatchEvent(new CustomEvent('plan:regenerated', { detail }))
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).slice(2),
          role: 'assistant',
          content: 'Sorry, kichu somossa holo.',
          createdAt: new Date().toISOString(),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-white/10">
        <h2 className="text-lg font-semibold">Study Agent</h2>
        <p className="text-xs text-white/60">Gemini-powered planner helper</p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((m) => (
          <div key={m.id} className={`rounded-lg p-3 ${m.role === 'assistant' ? 'bg-white/5' : 'bg-indigo-500/20'}`}>
            <div className="text-xs text-white/50 mb-1">{m.role}</div>
            <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={sendMessage} className="p-3 border-t border-white/10 grid grid-cols-[1fr_auto] gap-2">
        <input
          className="input"
          placeholder="Ask: Ajke plan kichu suggest koro..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button className="btn btn-primary" disabled={loading}>
          {loading ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  )
}
