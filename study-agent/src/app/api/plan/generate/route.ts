import { NextRequest, NextResponse } from 'next/server'
import { rebuildPlan } from '@/lib/plan'

export async function POST(req: NextRequest) {
  try {
    let body: any = {}
    try {
      body = await req.json()
    } catch (err) {
      body = {}
    }

    const dayParam = typeof body.day === 'string' && body.day.toLowerCase() === 'tomorrow' ? 'tomorrow' : 'today'
    const focusParam = typeof body.focus === 'string' ? body.focus : undefined
    const startHourParam = typeof body.startHour === 'number' ? body.startHour : undefined

    const result = await rebuildPlan({ day: dayParam, focus: focusParam, startHour: startHourParam })

    return NextResponse.json({
      day: result.day,
      blocks: result.blocks,
      focusLabel: result.focusLabel ?? null,
      focusRaw: result.focusRaw ?? null,
      focusApplied: result.focusApplied,
      didUpdate: result.didUpdate,
      hadMatches: result.hadMatches,
    })
  } catch (e) {
    console.error('Plan generate error', e)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
