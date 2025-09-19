import { prisma } from '@/lib/prisma'
import { generateDailyBlocks } from '@/lib/scheduler'
import type { ScheduleBlock, Task } from '@prisma/client'

export type PlanDay = 'today' | 'tomorrow'

type PlanBlockWithTask = ScheduleBlock & { task: { title: string } | null }

type PlanRange = {
  start: Date
  end: Date
  planStart: Date
}

const FOCUS_STOPWORDS = new Set([
  'focus',
  'only',
  'just',
  'on',
  'niye',
  'niyei',
  'subject',
  'topic',
  'plan',
  'routine',
  'schedule',
  'study',
  'ajke',
  'ajker',
  'aaj',
  'aajke',
  'kal',
  'kalke',
  'tomorrow',
  'today',
  'amar',
  'please',
  'plz',
  'pls',
  'dorkar',
  'lagbe',
  'koro',
  'korun',
  'dao',
  'banan',
  'banao',
  'create',
  'generate',
  'help',
])

function clampHour(value: number | undefined, fallback: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback
  return Math.min(23, Math.max(0, Math.floor(value)))
}

function resolveDayRange(day: PlanDay, base: Date, startHour: number): PlanRange {
  const target = new Date(base)
  if (day === 'tomorrow') {
    target.setDate(target.getDate() + 1)
  }
  target.setHours(0, 0, 0, 0)

  const start = new Date(target)
  const end = new Date(target)
  end.setHours(23, 59, 59, 999)

  const planStart = new Date(target)
  planStart.setHours(startHour, 0, 0, 0)

  if (day === 'today') {
    const now = new Date(base)
    if (now > planStart) {
      planStart.setTime(now.getTime())
    }
  }

  return { start, end, planStart }
}

function capitalizeWords(value: string) {
  return value.replace(/\b([a-z\u0980-\u09FF])/g, (match) => match.toUpperCase())
}

type FocusInfo = {
  raw?: string
  tokens: string[]
  label?: string
  applied: boolean
}

function parseFocus(value?: string): FocusInfo {
  if (!value) return { tokens: [], applied: false }
  const raw = value.trim()
  if (!raw) return { raw, tokens: [], applied: false }

  const normalized = raw
    .toLowerCase()
    .replace(/[^a-z0-9\u0980-\u09FF\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!normalized) return { raw, tokens: [], applied: false }

  const tokens = normalized
    .split(' ')
    .filter((token) => token.length > 1 && !FOCUS_STOPWORDS.has(token))

  if (tokens.length === 0) {
    return { raw, tokens: [], applied: false }
  }

  const label = capitalizeWords(tokens.join(' '))

  return { raw, tokens, label, applied: true }
}

function buildTaskHaystack(title: string, subjectName?: string | null, description?: string | null) {
  return [title, subjectName ?? '', description ?? '']
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9\u0980-\u09FF\s]/g, ' ')
    .replace(/\s+/g, ' ')
}

async function fetchBlocksInRange(start: Date, end: Date): Promise<PlanBlockWithTask[]> {
  return prisma.scheduleBlock.findMany({
    where: { start: { gte: start }, end: { lte: end } },
    include: { task: { select: { title: true } } },
    orderBy: { start: 'asc' },
  })
}

export async function getPlanBlocks(options?: { day?: PlanDay }): Promise<PlanBlockWithTask[]> {
  const baseNow = new Date()
  const day: PlanDay = options?.day === 'tomorrow' ? 'tomorrow' : 'today'
  const { start, end } = resolveDayRange(day, baseNow, 9)
  return fetchBlocksInRange(start, end)
}

type RebuildPlanOptions = {
  day?: PlanDay
  focus?: string
  now?: Date
  startHour?: number
}

export type RebuildPlanResult = {
  blocks: PlanBlockWithTask[]
  day: PlanDay
  focusLabel?: string
  focusRaw?: string
  focusApplied: boolean
  didUpdate: boolean
  hadMatches: boolean
}

type TaskWithSubject = Task & { subject: { name: string } | null }

export async function rebuildPlan(options?: RebuildPlanOptions): Promise<RebuildPlanResult> {
  const baseNow = options?.now ?? new Date()
  const day: PlanDay = options?.day === 'tomorrow' ? 'tomorrow' : 'today'
  const startHour = clampHour(options?.startHour, 9)
  const { start, end, planStart } = resolveDayRange(day, baseNow, startHour)

  const focusInfo = parseFocus(options?.focus)

  const tasks: TaskWithSubject[] = await prisma.task.findMany({
    where: { NOT: { status: 'DONE' } },
    include: { subject: { select: { name: true } } },
  })

  const candidates = focusInfo.applied
    ? tasks.filter((task) => {
        const haystack = buildTaskHaystack(task.title, task.subject?.name ?? null, task.description ?? null)
        return focusInfo.tokens.every((token) => haystack.includes(token))
      })
    : tasks

  if (focusInfo.applied && candidates.length === 0) {
    const existing = await fetchBlocksInRange(start, end)
    return {
      blocks: existing,
      day,
      focusLabel: focusInfo.label,
      focusRaw: focusInfo.raw,
      focusApplied: true,
      didUpdate: false,
      hadMatches: false,
    }
  }

  const plainTasks: Task[] = candidates.map((task) => {
    const { subject, ...rest } = task
    return rest as Task
  })

  await prisma.scheduleBlock.deleteMany({
    where: { start: { gte: start }, end: { lte: end } },
  })

  const blocksToCreate = generateDailyBlocks(plainTasks, { now: planStart })

  if (blocksToCreate.length > 0) {
    await prisma.scheduleBlock.createMany({
      data: blocksToCreate.map((block) => ({
        taskId: block.taskId,
        start: block.start,
        end: block.end,
      })),
    })
  }

  const blocks = await fetchBlocksInRange(start, end)

  return {
    blocks,
    day,
    focusLabel: focusInfo.label,
    focusRaw: focusInfo.raw,
    focusApplied: focusInfo.applied,
    didUpdate: true,
    hadMatches: true,
  }
}
