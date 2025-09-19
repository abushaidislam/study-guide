import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const tasks = await prisma.task.findMany({
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  })
  return NextResponse.json({ tasks })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { title, description, subjectId, dueDate, estimatedMin, priority } = body || {}
    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'title required' }, { status: 400 })
    }

    const task = await prisma.task.create({
      data: {
        title,
        description: description || null,
        subjectId: subjectId || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        estimatedMin: typeof estimatedMin === 'number' ? estimatedMin : 50,
        priority: typeof priority === 'number' ? priority : 1,
      },
    })

    return NextResponse.json({ task })
  } catch (e) {
    console.error('Create task error', e)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
