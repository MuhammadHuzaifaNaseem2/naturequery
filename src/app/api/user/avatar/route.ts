import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function GET(req: Request) {
  try {
    const session = await auth()
    
    // If not authenticated, we could return a default generic avatar 
    // or just 404. Let's return a 404 for now, or redirect to a placeholder.
    if (!session?.user?.id) {
      return new NextResponse(null, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { image: true }
    })

    if (!user || !user.image || !user.image.startsWith('data:image/')) {
      return new NextResponse(null, { status: 404 })
    }

    // Extract base64 format and content
    // pattern: data:image/png;base64,iVBORw0KGgo...
    const matches = user.image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/)
    
    if (!matches || matches.length !== 3) {
      return new NextResponse(null, { status: 400 })
    }

    const mimeType = matches[1]
    const buffer = Buffer.from(matches[2], 'base64')

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=43200',
      },
    })
  } catch (error) {
    console.error('Failed to serve avatar:', error)
    return new NextResponse(null, { status: 500 })
  }
}
