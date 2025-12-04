'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatDistanceToNow, format } from 'date-fns'
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  MessageSquare,
  Clock,
  Eye,
  Forward,
  Image,
  Trash2,
  Send,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { AdminPageHeader } from '@/components/admin/layout/admin-page-header'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface TelegramChannel {
  id: string
  channelId: string
  username: string
  title: string
  enabled: boolean
  lastFetchAt: string | null
  errorCount: number
  lastError: string | null
  _count?: {
    messages: number
  }
}

interface TelegramMessage {
  id: string
  messageId: string
  text: string | null
  date: string
  senderName: string | null
  views: number | null
  forwards: number | null
  hasMedia: boolean
  mediaType: string | null
  channel: TelegramChannel
}

interface TelegramStats {
  totalChannels: number
  enabledChannels: number
  totalMessages: number
  messagesLast24h: number
  lastUpdate: string | null
}

interface TelegramMonitorClientProps {
  accessToken: string
}

export function TelegramMonitorClient({ accessToken }: TelegramMonitorClientProps) {
  const [channels, setChannels] = useState<TelegramChannel[]>([])
  const [messages, setMessages] = useState<TelegramMessage[]>([])
  const [stats, setStats] = useState<TelegramStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<Record<string, boolean>>({})
  const [cleaningUp, setCleaningUp] = useState(false)
  const [totalMessages, setTotalMessages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const messagesPerPage = 50

  const fetchChannels = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/telegram/channels`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
      if (response.ok) {
        const data = await response.json()
        setChannels(data.channels || [])
      } else {
        console.error('Fetch channels failed:', response.status)
      }
    } catch (error) {
      console.error('Failed to fetch channels:', error)
    }
  }, [accessToken])

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/telegram/stats`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
      if (response.ok) {
        const data = await response.json()
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }, [accessToken])

  const fetchMessages = useCallback(
    async (page: number = 1) => {
      try {
        const params = new URLSearchParams({
          limit: String(messagesPerPage),
          page: String(page),
        })

        const response = await fetch(`${API_BASE_URL}/api/admin/telegram/messages?${params}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
        if (response.ok) {
          const data = await response.json()
          setMessages(data.messages || [])
          setTotalMessages(data.total || 0)
        }
      } catch (error) {
        console.error('Failed to fetch messages:', error)
      }
    },
    [accessToken]
  )

  const toggleChannel = async (channelId: string, enabled: boolean) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/telegram/channels/${channelId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled }),
      })
      if (response.ok) {
        await fetchChannels()
      }
    } catch (error) {
      console.error('Failed to toggle channel:', error)
    }
  }

  const deleteChannel = async (channelId: string, username: string) => {
    if (
      !confirm(
        `Are you sure you want to delete @${username} and all its messages? This cannot be undone.`
      )
    ) {
      return
    }

    setDeleting((prev) => ({ ...prev, [channelId]: true }))
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/telegram/channels/${channelId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
      if (response.ok) {
        const data = await response.json()
        alert(data.message)
        await fetchChannels()
        await fetchStats()
        await fetchMessages(currentPage)
      } else {
        const errorData = await response.json().catch(() => ({}))
        alert(`Failed to delete channel: ${errorData.error || response.statusText}`)
      }
    } catch (error) {
      console.error('Failed to delete channel:', error)
      alert(`Failed to delete channel: ${error instanceof Error ? error.message : 'Network error'}`)
    } finally {
      setDeleting((prev) => ({ ...prev, [channelId]: false }))
    }
  }

  const cleanupOldMessages = async () => {
    setCleaningUp(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/telegram/cleanup`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ maxMessages: 1000 }),
      })
      if (response.ok) {
        const data = await response.json()
        alert(data.message)
        await fetchStats()
        await fetchMessages(currentPage)
      }
    } catch (error) {
      console.error('Failed to cleanup messages:', error)
    } finally {
      setCleaningUp(false)
    }
  }

  const refreshData = async () => {
    setLoading(true)
    await Promise.all([fetchChannels(), fetchStats(), fetchMessages(currentPage)])
    setLoading(false)
  }

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([fetchChannels(), fetchStats(), fetchMessages(1)])
      setLoading(false)
    }
    loadData()

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchMessages(currentPage)
      fetchStats()
    }, 30000)

    return () => clearInterval(interval)
  }, [fetchChannels, fetchStats, fetchMessages, currentPage])

  useEffect(() => {
    fetchMessages(currentPage)
  }, [currentPage, fetchMessages])

  const getChannelStatusIcon = (channel: TelegramChannel) => {
    if (channel.errorCount > 0) {
      return <XCircle className="w-5 h-5 text-red-500" />
    }
    if (channel.enabled) {
      return <CheckCircle className="w-5 h-5 text-green-500" />
    }
    return <XCircle className="w-5 h-5 text-gray-400" />
  }

  const totalPages = Math.ceil(totalMessages / messagesPerPage)

  if (loading) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          title="Telegram Monitor"
          description="Loading Telegram channel data..."
        />
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Telegram Monitor"
        description="Monitor messages from Telegram channels in real-time. Messages auto-refresh every 30 seconds."
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats?.totalChannels || 0}</div>
            <p className="text-xs text-muted-foreground">Total Channels</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{stats?.enabledChannels || 0}</div>
            <p className="text-xs text-muted-foreground">Enabled Channels</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats?.totalMessages || 0}</div>
            <p className="text-xs text-muted-foreground">Total Messages</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">{stats?.messagesLast24h || 0}</div>
            <p className="text-xs text-muted-foreground">Last 24 Hours</p>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={refreshData} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh Now
        </Button>
        <Button onClick={cleanupOldMessages} disabled={cleaningUp} variant="outline">
          {cleaningUp ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4 mr-2" />
          )}
          Cleanup (Keep 1000)
        </Button>
        {stats?.lastUpdate && (
          <div className="flex items-center text-sm text-muted-foreground">
            <Clock className="w-4 h-4 mr-1" />
            Last update: {formatDistanceToNow(new Date(stats.lastUpdate), { addSuffix: true })}
          </div>
        )}
      </div>

      {/* Channels Section */}
      {channels.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              Monitored Channels ({channels.length})
            </CardTitle>
            <CardDescription>
              Channels being monitored by the Pyrogram poller on Digital Ocean.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {channels.map((channel) => (
              <div
                key={channel.id}
                className="flex items-center justify-between p-4 border rounded-lg bg-card"
              >
                <div className="flex items-center gap-3">
                  {getChannelStatusIcon(channel)}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">@{channel.username}</span>
                      <Badge variant="secondary" className="text-xs">
                        {channel._count?.messages || 0} messages
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">{channel.title}</div>
                    {channel.lastFetchAt && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" />
                        Last fetched:{' '}
                        {formatDistanceToNow(new Date(channel.lastFetchAt), { addSuffix: true })}
                      </div>
                    )}
                    {channel.errorCount > 0 && (
                      <div className="text-xs text-red-600 mt-1">
                        {channel.errorCount} error(s) - {channel.lastError}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {channel.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                    <Switch
                      checked={channel.enabled}
                      onCheckedChange={(checked) => toggleChannel(channel.id, checked)}
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deleteChannel(channel.id, channel.username)}
                    disabled={deleting[channel.id]}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                  >
                    {deleting[channel.id] ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Messages Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Messages ({totalMessages})
          </CardTitle>
          <CardDescription>
            Latest messages from all monitored channels. Auto-refreshes every 30 seconds.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {messages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No messages yet</p>
              <p className="text-sm mt-1">
                Messages will appear here once the Pyrogram poller starts sending data.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className="p-4 border rounded-lg bg-card hover:border-brand-500/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400">
                            @{message.channel.username}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(message.date), 'MMM d, yyyy h:mm a')}
                          </span>
                          {message.hasMedia && (
                            <Badge variant="secondary" className="text-xs">
                              <Image className="w-3 h-3 mr-1" />
                              {message.mediaType || 'media'}
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm whitespace-pre-wrap break-words">
                          {message.text || (
                            <span className="text-muted-foreground italic">
                              [No text content - media only]
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                          {message.views !== null && (
                            <span className="flex items-center gap-1">
                              <Eye className="w-3 h-3" />
                              {message.views.toLocaleString()} views
                            </span>
                          )}
                          {message.forwards !== null && message.forwards > 0 && (
                            <span className="flex items-center gap-1">
                              <Forward className="w-3 h-3" />
                              {message.forwards.toLocaleString()} forwards
                            </span>
                          )}
                          {message.senderName && (
                            <span className="flex items-center gap-1">
                              From: {message.senderName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
