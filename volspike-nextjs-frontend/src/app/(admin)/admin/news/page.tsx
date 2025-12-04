import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { AdminLayout } from '@/components/admin/layout/admin-layout'
import { NewsReviewClient } from './news-review-client'

export const metadata: Metadata = {
  title: 'News Feeds - Admin',
  description: 'Review and manage RSS news feed sources',
}

export default async function NewsPage() {
  const session = await auth()

  if (!session?.user) {
    redirect('/auth?next=/admin/news&mode=admin')
  }

  if (session.user.role !== 'ADMIN') {
    redirect('/auth?next=/admin/news&mode=admin&error=access_denied')
  }

  const accessToken = (session as any)?.accessToken
  if (!accessToken) {
    redirect('/auth?next=/admin/news&mode=admin&error=token_missing')
  }

  return (
    <AdminLayout>
      <NewsReviewClient accessToken={accessToken} />
    </AdminLayout>
  )
}
