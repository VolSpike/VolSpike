'use client'

import { useMemo } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Newspaper, RefreshCw } from 'lucide-react'
import { useTelegramMessages, TelegramMessage } from '@/hooks/use-telegram-messages'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// Category configuration with colors matching admin panel
const CATEGORY_CONFIG: Record<string, { label: string; className: string }> = {
  macro: {
    label: 'Macro',
    className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  },
  crypto: {
    label: 'Crypto',
    className: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30',
  },
  general: {
    label: 'General',
    className: 'bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30',
  },
}

function getCategoryConfig(category: string) {
  return CATEGORY_CONFIG[category] || CATEGORY_CONFIG.general
}

// Clean message text - remove channel-specific trailing content
function cleanMessageText(text: string | null, channelUsername: string): string | null {
  if (!text) return null
  const channel = channelUsername.toLowerCase()
  if (channel === 'marketfeed') {
    // Remove trailing "..." from marketfeed messages
    return text.replace(/\s*\.{3,}$/, '').trim()
  }
  if (channel === 'watcherguru') {
    // Remove trailing "@WatcherGuru" from WatcherGuru messages
    return text.replace(/\s*@WatcherGuru\s*$/i, '').trim()
  }
  return text
}

interface MarketNewsPaneProps {
  className?: string
  maxMessages?: number
  pollInterval?: number
}

function MessageItem({ message }: { message: TelegramMessage }) {
  const categoryConfig = getCategoryConfig(message.category)
  const cleanedText = cleanMessageText(message.text, message.channelUsername)
  const timeAgo = formatDistanceToNow(new Date(message.date), { addSuffix: true })

  return (
    <div className="flex-shrink-0 p-3 border-b border-border/40 last:border-b-0 hover:bg-muted/30 transition-colors">
      <div className="flex items-start gap-2">
        <Badge
          variant="outline"
          className={cn('text-[10px] px-1.5 py-0 h-5 flex-shrink-0', categoryConfig.className)}
        >
          {categoryConfig.label}
        </Badge>
        <span className="text-[10px] text-muted-foreground flex-shrink-0 mt-0.5">{timeAgo}</span>
      </div>
      <p className="text-xs mt-1.5 text-foreground/90 leading-relaxed line-clamp-2">
        {cleanedText || (
          <span className="text-muted-foreground italic">[Media only]</span>
        )}
      </p>
    </div>
  )
}

export function MarketNewsPane({
  className,
  maxMessages = 100,
  pollInterval = 30000,
}: MarketNewsPaneProps) {
  const { messages, isLoading, error, lastUpdate } = useTelegramMessages({
    limit: maxMessages,
    pollInterval,
    autoFetch: true,
  })

  // Filter out media-only messages for cleaner display
  const displayMessages = useMemo(() => {
    return messages.filter((msg) => msg.text && msg.text.trim().length > 0)
  }, [messages])

  return (
    <Card className={cn('border border-border/60 shadow-md', className)}>
      <CardHeader className="py-2 px-4 border-b border-border/40">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Newspaper className="w-4 h-4 text-brand-500" />
            Market News
          </CardTitle>
          {isLoading && (
            <RefreshCw className="w-3 h-3 animate-spin text-muted-foreground" />
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {error ? (
          <div className="p-4 text-xs text-red-500 text-center">{error}</div>
        ) : displayMessages.length === 0 ? (
          <div className="p-4 text-xs text-muted-foreground text-center">
            {isLoading ? 'Loading news...' : 'No news available'}
          </div>
        ) : (
          <div className="overflow-y-auto max-h-[180px] scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
            {displayMessages.map((message) => (
              <MessageItem key={message.id} message={message} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
