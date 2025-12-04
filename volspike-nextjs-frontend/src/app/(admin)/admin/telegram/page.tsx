import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { AdminLayout } from '@/components/admin/layout/admin-layout'
import { TelegramMonitorClient } from './telegram-monitor-client'

export const metadata: Metadata = {
  title: 'Telegram Monitor - Admin',
  description: 'Monitor messages from Telegram channels',
}

export default async function TelegramPage() {
  const session = await auth()

  if (!session?.user) {
    redirect('/auth?next=/admin/telegram&mode=admin')
  }

  if (session.user.role !== 'ADMIN') {
    redirect('/auth?next=/admin/telegram&mode=admin&error=access_denied')
  }

  const accessToken = (session as any)?.accessToken
  if (!accessToken) {
    redirect('/auth?next=/admin/telegram&mode=admin&error=token_missing')
  }

  return (
    <AdminLayout>
      <TelegramMonitorClient accessToken={accessToken} />
    </AdminLayout>
  )
}
