import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getStudyAgentModel } from '@/lib/gemini'
import { rebuildPlan, type PlanDay, type RebuildPlanResult } from '@/lib/plan'
import type { ChatMessage } from '@prisma/client'

const PLAN_KEYWORDS = [
  'plan',
  'planner',
  'planning',
  'routine',
  'schedule',
  'study',
  'studyplan',
  'porikolpona',
  'porikalpona',
  'porikolpana',
  'porikalpana',
  'porikolpona',
]

const PLAN_ACTIONS = [
  'ban',
  'banao',
  'banan',
  'bana',
  'baniye',
  'kor',
  'koro',
  'korbo',
  'kore',
  'korun',
  'dao',
  'dorkar',
  'lagbe',
  'chai',
  'chahi',
  'create',
  'generate',
  'suggest',
  'help',
  'update',
  'refresh',
]

const DIRECT_INTENTS = [
  'plan dao',
  'plan koro',
  'plan ban',
  'plan banan',
  'plan banao',
  'planner update',
  'routine dao',
  'routine ban',
  'schedule dao',
  'daily plan',
  'study plan',
  'study schedule',
  'next plan',
]

const TODAY_HINTS = ['ajk', 'ajke', 'ajker', 'aaj', 'aajke', 'today']
const TOMORROW_HINTS = ['kal', 'kalke', 'kalka', 'tomorrow', 'agami', 'nextday']

const FOCUS_PATTERNS = [
  /focus(?: on)?\s+([a-z\u0980-\u09FF\s]{3,40})/i,
  /only\s+([a-z\u0980-\u09FF\s]{3,40})/i,
  /just\s+([a-z\u0980-\u09FF\s]{3,40})/i,
  /plan\s+(?:for|on)\s+([a-z\u0980-\u09FF\s]{3,40})/i,
  /([a-z\u0980-\u09FF\s]{3,40})\s+(?:niye|er)\s+plan/i,
]

type PlanIntent = {
  shouldRebuild: boolean
  day: PlanDay
  focus?: string
}

function normalizeText(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u0980-\u09FF\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(normalized: string) {
  if (!normalized) return [] as string[]
  return normalized.split(' ').filter(Boolean)
}

function detectDay(tokenSet: Set<string>): PlanDay {
  for (const word of TOMORROW_HINTS) {
    if (tokenSet.has(word)) return 'tomorrow'
  }
  return 'today'
}

function extractFocus(raw: string) {
  for (const pattern of FOCUS_PATTERNS) {
    const match = raw.match(pattern)
    if (match && match[1]) {
      const cleaned = match[1]
        .replace(/\b(plan|routine|schedule|study|ajker|ajk|aaj|aajke|today|kal|kalke|tomorrow)\b/gi, ' ')
        .replace(/[^a-z0-9\u0980-\u09FF\s]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      if (cleaned.length > 1) {
        return cleaned
      }
    }
  }
  return undefined
}

function inferPlanIntent(text: string): PlanIntent {
  const normalized = normalizeText(text)
  const tokens = tokenize(normalized)
  const tokenSet = new Set(tokens)

  const day = detectDay(tokenSet)
  const hasKeyword = PLAN_KEYWORDS.some((word) => tokenSet.has(word))
  const hasAction = PLAN_ACTIONS.some((word) => tokenSet.has(word))
  const directIntent = DIRECT_INTENTS.some((phrase) => normalized.includes(phrase))
  const focus = extractFocus(text)
  const mentionToday = TODAY_HINTS.some((word) => tokenSet.has(word))
  const shortRequest = hasKeyword && tokens.length <= 4 && (day === 'tomorrow' || mentionToday)

  const shouldRebuild = directIntent || (hasKeyword && (hasAction || day === 'tomorrow' || !!focus || shortRequest))

  return { shouldRebuild, day, focus }
}

function formatTime(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value)
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function diffMinutes(start: Date | string, end: Date | string) {
  const startMs = new Date(start).getTime()
  const endMs = new Date(end).getTime()
  return Math.max(0, Math.round((endMs - startMs) / 60000))
}

function formatDuration(minutes: number) {
  if (minutes <= 0) return '0m'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours && mins) return `${hours}h ${mins}m`
  if (hours) return `${hours}h`
  return `${mins}m`
}

function formatPlanReply(result: RebuildPlanResult) {
  const { blocks, day, focusLabel, focusRaw, focusApplied, didUpdate, hadMatches } = result

  if (focusApplied && !hadMatches) {
    const label = focusLabel ?? focusRaw ?? 'selected topic'
    return `Focus "${label}" er sathe kono task pawa gelo na, tai plan change kori nai. Task list e oi focus er kaj add kore abar bolo.`
  }

  if (!blocks.length) {
    const dayPrefix = day === 'tomorrow' ? 'Kalke' : 'Ajker'
    let base = `${dayPrefix} plan banate parlam na, karon kono active task pawa gelo na.`
    if (focusLabel) {
      base += ` Focus "${focusLabel}" er kono task list e nei.`
    }
    return `${base} Task list e kaj add kore abar bolo.`
  }

  const header = day === 'tomorrow' ? 'Kalke plan ready!' : 'Ajker plan ready!'
  const focusLine = focusApplied && focusLabel ? `Focus: ${focusLabel}` : undefined
  const lines = blocks.map((block, index) => {
    const start = formatTime(block.start)
    const end = formatTime(block.end)
    const title = block.task?.title ?? 'Focus block'
    return `${index + 1}. ${start} - ${end}: ${title}`
  })

  const totalMinutes = blocks.reduce((acc, block) => acc + diffMinutes(block.start, block.end), 0)
  const totalLine = `Mot focus time: ${formatDuration(totalMinutes)}.`
  const updateLine = didUpdate
    ? 'Planner panel e blocks gulo update hoye geche.'
    : 'Planner e ager plan e kono poriborton laglo na.'
  const ignoredFocusLine = !focusApplied && focusRaw
    ? `Focus "${focusRaw.trim()}" bujhte parini, tai default plan dilam.`
    : undefined

  return [
    header,
    ...(focusLine ? [focusLine] : []),
    ...lines,
    '',
    totalLine,
    updateLine,
    ...(ignoredFocusLine ? ['', ignoredFocusLine] : []),
  ].join('\n')
}

export async function GET() {
  const messages = await prisma.chatMessage.findMany({
    orderBy: { createdAt: 'asc' },
    take: 50,
  })
  return NextResponse.json({ messages })
}

export async function POST(req: NextRequest) {
  try {
    const body: any = await req.json().catch(() => ({}))
    const text: string = (body?.message || '').toString()
    if (!text.trim()) return NextResponse.json({ error: 'Empty message' }, { status: 400 })

    await prisma.chatMessage.create({
      data: { role: 'user', content: text },
    })

    const intent = inferPlanIntent(text)

    if (intent.shouldRebuild) {
      const planResult = await rebuildPlan({ day: intent.day, focus: intent.focus })
      const reply = formatPlanReply(planResult)
      const assistantMsg = await prisma.chatMessage.create({
        data: { role: 'assistant', content: reply },
      })

      return NextResponse.json({
        id: assistantMsg.id,
        reply,
        planGenerated: true,
        planDay: planResult.day,
        planFocusLabel: planResult.focusLabel ?? null,
        planFocusRaw: planResult.focusRaw ?? null,
        planFocusApplied: planResult.focusApplied,
        planDidUpdate: planResult.didUpdate,
        planHadMatches: planResult.hadMatches,
      })
    }

    const history = await prisma.chatMessage.findMany({
      orderBy: { createdAt: 'asc' },
      take: 20,
    })

    const model = getStudyAgentModel()

    const chat = model.startChat({
      history: history.map((m: ChatMessage) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
    })

    const response = await chat.sendMessage(text)
    const reply = response.response.text()

    const assistantMsg = await prisma.chatMessage.create({
      data: { role: 'assistant', content: reply },
    })

    return NextResponse.json({ id: assistantMsg.id, reply })
  } catch (e: any) {
    console.error('Chat error', e)
    return NextResponse.json({ error: 'Chat failed' }, { status: 500 })
  }
}
