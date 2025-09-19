"use client"

import React, { useEffect, useState } from 'react'

interface Task {
  id: string
  title: string
  description?: string | null
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE'
  dueDate?: string | null
  estimatedMin?: number | null
  priority: number
}

export default function TaskList() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [estimatedMin, setEstimatedMin] = useState(50)
  const [priority, setPriority] = useState(1)

  async function load() {
    const r = await fetch('/api/tasks')
    const data = await r.json()
    setTasks(data.tasks || [])
  }

  useEffect(() => { load() }, [])

  async function addTask(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, dueDate: dueDate || undefined, estimatedMin, priority }),
    })
    setTitle('')
    setDueDate('')
    setEstimatedMin(50)
    setPriority(1)
    load()
  }

  async function toggleDone(id: string, done: boolean) {
    await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: done ? 'DONE' : 'PENDING' }),
    })
    load()
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Tasks</h3>

      <form onSubmit={addTask} className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <input className="input" placeholder="Task title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className="input" type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input className="input" type="number" min={10} max={240} step={5} value={estimatedMin} onChange={(e) => setEstimatedMin(parseInt(e.target.value))} />
          <select className="input" value={priority} onChange={(e) => setPriority(parseInt(e.target.value))}>
            <option value={1}>Priority 1</option>
            <option value={2}>Priority 2</option>
            <option value={3}>Priority 3</option>
          </select>
        </div>
        <button className="btn btn-primary w-full">Add Task</button>
      </form>

      <div className="space-y-2">
        {tasks.map(t => (
          <label key={t.id} className="flex items-center gap-3 p-2 bg-white/5 rounded-lg">
            <input type="checkbox" checked={t.status === 'DONE'} onChange={(e) => toggleDone(t.id, e.target.checked)} />
            <div className="flex-1">
              <div className="font-medium">{t.title}</div>
              <div className="text-xs text-white/60">Due: {t.dueDate ? new Date(t.dueDate).toLocaleString() : '—'} · Est: {t.estimatedMin || 50}m · P{t.priority}</div>
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}
