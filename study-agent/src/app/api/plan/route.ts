import { NextRequest, NextResponse } from 'next/server'
import { getPlanBlocks, type PlanDay } from '@/lib/plan'

function parseDay(value: string | null): PlanDay {
  if (!value) return 'today'
  const lowercase = value.toLowerCase()
  return lowercase === 'tomorrow' ? 'tomorrow' : 'today'
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const day = parseDay(searchParams.get('day'))
  const blocks = await getPlanBlocks({ day })
  return NextResponse.json({ day, blocks })
}
