import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { locales } from '@/types/locale'

export async function POST(request: Request) {
    try {
        const session = await auth()

        const { locale } = await request.json()

        // Validate locale
        if (!locales.includes(locale)) {
            return NextResponse.json(
                { error: 'Invalid locale' },
                { status: 400 }
            )
        }

        // If user is authenticated, update their preference in DB
        if (session?.user?.id) {
            await prisma.user.update({
                where: { id: session.user.id },
                data: { locale }
            })
        }

        // Set cookie for both authenticated and unauthenticated users
        const response = NextResponse.json({ success: true })
        response.cookies.set('NEXT_LOCALE', locale, {
            path: '/',
            maxAge: 31536000, // 1 year
            sameSite: 'lax'
        })

        return response
    } catch (error) {
        console.error('Error updating locale:', error)
        return NextResponse.json(
            { error: 'Failed to update locale' },
            { status: 500 }
        )
    }
}
