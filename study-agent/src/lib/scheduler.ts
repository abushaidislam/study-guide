import { Task, TaskStatus } from '@prisma/client'

export type BlockInput = {
  taskId: string
  start: Date
  end: Date
}

function roundUpToMinutes(date: Date, minutes: number) {
  const ms = minutes * 60 * 1000
  return new Date(Math.ceil(date.getTime() / ms) * ms)
}

export function scoreTask(task: Task, now = new Date()): number {
  const msInDay = 24 * 60 * 60 * 1000
  const daysUntil = task.dueDate ? Math.max(0, (task.dueDate.getTime() - now.getTime()) / msInDay) : 14
  const urgency = 1 / (1 + daysUntil) // closer deadlines score higher
  const priority = Math.min(3, Math.max(1, task.priority || 1)) / 3 // normalize 1..3
  const est = Math.min(1, Math.max(0.25, (task.estimatedMin || 30) / 120))
  return 0.5 * urgency + 0.4 * priority + 0.1 * est
}

export function generateDailyBlocks(tasks: Task[], options?: { totalMinutes?: number; blockMinutes?: number; now?: Date }): BlockInput[] {
  const now = options?.now ?? new Date()
  const totalMinutes = options?.totalMinutes ?? 180 // plan ~3 hours by default
  const blockMinutes = options?.blockMinutes ?? 50

  const candidates = tasks.filter(t => t.status !== TaskStatus.DONE)
  candidates.sort((a, b) => scoreTask(b, now) - scoreTask(a, now))

  const blocks: BlockInput[] = []
  let cursor = roundUpToMinutes(now, 5)
  let remaining = totalMinutes

  for (const task of candidates) {
    if (remaining <= 0) break
    let est = Math.max(25, Math.min(blockMinutes, task.estimatedMin || blockMinutes))
    if (est > remaining) est = remaining

    const start = new Date(cursor)
    const end = new Date(cursor.getTime() + est * 60 * 1000)
    blocks.push({ taskId: task.id, start, end })
    cursor = new Date(end.getTime() + 10 * 60 * 1000) // 10 min break
    remaining -= est
  }

  return blocks
}
