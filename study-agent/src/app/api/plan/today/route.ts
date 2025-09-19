import { NextResponse } from 'next/server'
import { getPlanBlocks } from '@/lib/plan'

export async function GET() {
  const blocks = await getPlanBlocks({ day: 'today' })
  return NextResponse.json({ blocks })
}
