import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { AdminLayout } from '@/components/admin/layout/admin-layout'
import { SocialMediaClient } from './social-media-client'

export const metadata: Metadata = {
  title: 'Social Media - Admin',
  description: 'Manage and post alert images to Twitter/X',
}

export default async function SocialMediaPage() {
  const session = await auth()

  if (!session?.user) {
    redirect('/auth?next=/admin/social-media&mode=admin')
  }

  if (session.user.role !== 'ADMIN') {
    redirect('/auth?next=/admin/social-media&mode=admin&error=access_denied')
  }

  const accessToken = (session as any)?.accessToken
  if (!accessToken) {
    redirect('/auth?next=/admin/social-media&mode=admin&error=token_missing')
  }

  return (
    <AdminLayout>
      <SocialMediaClient accessToken={accessToken} />
    </AdminLayout>
  )
}
