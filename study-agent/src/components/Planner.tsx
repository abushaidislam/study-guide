"use client"

import clsx from 'clsx'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

interface Block { id: string; taskId?: string | null; start: string; end: string; task?: { title: string } }
type PlanDay = 'today' | 'tomorrow'
type StatusTone = 'success' | 'error' | 'info'
type StatusState = { type: StatusTone; message: string }

type PlanEventDetail = {
  day?: PlanDay
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

const STATUS_STYLES: Record<StatusTone, string> = {
  success: 'bg-emerald-500/10 text-emerald-200 border border-emerald-500/30',
  error: 'bg-rose-500/10 text-rose-200 border border-rose-500/30',
  info: 'bg-sky-500/10 text-sky-200 border border-sky-500/30',
}

const DAY_OPTIONS: Array<{ value: PlanDay; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
]

function formatDuration(minutes: number) {
  if (minutes <= 0) return '0m'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours && mins) return `${hours}h ${mins}m`
  if (hours) return `${hours}h`
  return `${mins}m`
}

function getFocusLabel(detail: PlanEventDetail) {
  return detail.focusLabel || detail.focusRaw || ''
}

export default function Planner() {
  const [blocks, setBlocks] = useState<Block[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<StatusState | null>(null)
  const [selectedDay, setSelectedDay] = useState<PlanDay>('today')
  const [focusInput, setFocusInput] = useState('')
  const [isFetching, setIsFetching] = useState(false)
  const dayLabel = selectedDay === 'today' ? 'Today' : 'Tomorrow'
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showStatus = useCallback((message: string, type: StatusTone = 'info') => {
    if (statusTimerRef.current) {
      clearTimeout(statusTimerRef.current)
    }
    setStatus({ type, message })
    statusTimerRef.current = setTimeout(() => {
      setStatus(null)
      statusTimerRef.current = null
    }, 5000)
  }, [])

  const load = useCallback(async (day: PlanDay) => {
    setIsFetching(true)
    try {
      const res = await fetch(`/api/plan?day=${day}`)
      if (!res.ok) throw new Error('plan_fetch_failed')
      const data = await res.json()
      setBlocks(data.blocks || [])
    } catch (e) {
      showStatus('Plan reload kora gelo na. Connection check korun.', 'error')
    } finally {
      setIsFetching(false)
    }
  }, [showStatus])

  useEffect(() => {
    load(selectedDay)
  }, [selectedDay, load])

  useEffect(() => {
    const handler = (event: PlanRegeneratedEvent) => {
      const detail = event.detail || {}
      const eventDay: PlanDay = detail.day === 'tomorrow' ? 'tomorrow' : 'today'

      if (eventDay === selectedDay) {
        load(selectedDay)
        if (detail.focusApplied && detail.hadMatches === false) {
          const label = getFocusLabel(detail)
          showStatus(`Focus "${label}" er sathe task pawa gelo na. Existing plan thik ache.`, 'error')
        } else if (detail.didUpdate) {
          showStatus('Chat diye notun plan apply hoye geche!', 'success')
        } else {
          showStatus('Chat request e kono poriborton dorkar holo na.', 'info')
        }
        return
      }

      const labelMap: Record<PlanDay, string> = { today: 'Today', tomorrow: 'Tomorrow' }
      if (detail.didUpdate) {
        showStatus(`${labelMap[eventDay]} plan chat diye update hoye geche. Switch kore check korun.`, 'info')
      } else {
        showStatus(`${labelMap[eventDay]} plan unchanged. Kintu chat request chilo.`, 'info')
      }
    }

    window.addEventListener('plan:regenerated', handler)
    return () => window.removeEventListener('plan:regenerated', handler)
  }, [load, selectedDay, showStatus])

  useEffect(() => () => {
    if (statusTimerRef.current) {
      clearTimeout(statusTimerRef.current)
    }
  }, [])

  async function generate() {
    setLoading(true)
    try {
      const payload: Record<string, unknown> = { day: selectedDay }
      const trimmedFocus = focusInput.trim()
      if (trimmedFocus) {
        payload.focus = trimmedFocus
      }

      const res = await fetch('/api/plan/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        throw new Error('plan_failed')
      }

      const data = await res.json()
      await load(selectedDay)

      if (data.focusApplied && data.hadMatches === false) {
        const label = data.focusLabel || data.focusRaw || trimmedFocus || 'selected topic'
        showStatus(`Focus "${label}" er sathe task pawa gelo na. Existing plan e poriborton kori nai.`, 'error')
      } else if (data.didUpdate) {
        showStatus('Plan successfully update hoye geche!', 'success')
      } else {
        showStatus('Plan e kono notun poriborton dorkar holo na.', 'info')
      }
    } catch (e) {
      showStatus('Plan generate korte somossa holo. Please abr try korun.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const totalMinutes = useMemo(() => {
    return blocks.reduce((acc, block) => {
      const start = new Date(block.start).getTime()
      const end = new Date(block.end).getTime()
      return acc + Math.max(0, Math.round((end - start) / 60000))
    }, 0)
  }, [blocks])

  const isEmpty = blocks.length === 0

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">{`${dayLabel}'s Plan`}</h3>
          <div className="text-xs text-white/50">Chat request er sathe sync hoy.</div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex rounded-md border border-white/10 overflow-hidden">
            {DAY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSelectedDay(option.value)}
                className={clsx(
                  'px-3 py-1 text-sm transition-colors duration-150',
                  option.value === selectedDay
                    ? 'bg-indigo-500/70 text-white'
                    : 'bg-white/5 text-white/70 hover:bg-white/10'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="input"
              placeholder="Focus (optional): e.g. Math"
              value={focusInput}
              onChange={(e) => setFocusInput(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={generate}
              disabled={loading}
            >
              {loading ? 'Planning...' : 'Generate Plan'}
            </button>
          </div>
        </div>
      </div>

      {status && (
        <div className={`text-sm rounded-md px-3 py-2 ${STATUS_STYLES[status.type]}`}>
          {status.message}
        </div>
      )}

      {isFetching && (
        <div className="text-xs text-white/50">Loading plan...</div>
      )}

      {!isFetching && blocks.length > 0 && (
        <div className="text-xs text-white/60">
          Mot focus time: {formatDuration(totalMinutes)} | Blocks: {blocks.length}
        </div>
      )}

      <div className="space-y-2">
        {!isFetching && isEmpty && (
          <div className="text-white/60">No blocks yet. Generate kore dekhen.</div>
        )}
        {blocks.map((block) => {
          const start = new Date(block.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          const end = new Date(block.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          return (
            <div key={block.id} className="p-3 bg-white/5 rounded-lg border border-white/10">
              <div className="text-sm font-medium">{start} - {end}</div>
              <div className="text-white/80">{block.task?.title || 'Focus block'}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
