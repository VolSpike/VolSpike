import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { AcademyPreview } from './academy-preview'

export const metadata: Metadata = {
    title: 'Academy Preview - Admin',
    description: 'Preview VolSpike Academy as a user would see it',
}

export default async function AcademyPreviewPage() {
    const session = await auth()

    if (!session?.user || session.user.role !== 'ADMIN') {
        redirect('/auth?next=/admin/academy/preview&mode=admin')
    }

    return <AcademyPreview accessToken={session.accessToken || ''} />
}
