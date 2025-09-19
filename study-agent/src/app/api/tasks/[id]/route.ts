import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id
    const body = await req.json()
    const { title, description, status, dueDate, estimatedMin, priority } = body || {}

    const task = await prisma.task.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
        ...(estimatedMin !== undefined ? { estimatedMin } : {}),
        ...(priority !== undefined ? { priority } : {}),
      },
    })

    return NextResponse.json({ task })
  } catch (e) {
    console.error('Update task error', e)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id
    const task = await prisma.task.findUnique({ where: { id } })
    if (!task) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json({ task })
  } catch (e) {
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
