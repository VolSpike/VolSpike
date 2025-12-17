'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Loader2, RefreshCw, Twitter, X, Send, AlertCircle, ExternalLink, Check } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { adminAPI } from '@/lib/admin/api-client'
import type { QueuedPostWithAlert } from '@/types/social-media'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'

export default function SocialMediaPage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState('queue')
  const [queue, setQueue] = useState<QueuedPostWithAlert[]>([])
  const [history, setHistory] = useState<QueuedPostWithAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Fetch queue
  const fetchQueue = async (showLoading = true) => {
    if (showLoading) setLoading(true)
    try {
      const response = await adminAPI.getSocialMediaQueue()
      setQueue(response.data || [])
    } catch (error: any) {
      console.error('[SocialMedia] Error fetching queue:', error)
      toast({
        title: 'Error',
        description: 'Failed to load queue',
        variant: 'destructive',
      })
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  // Fetch history
  const fetchHistory = async (showLoading = true) => {
    if (showLoading) setLoading(true)
    try {
      const response = await adminAPI.getSocialMediaHistory({ limit: 100 })
      setHistory(response.data || [])
    } catch (error: any) {
      console.error('[SocialMedia] Error fetching history:', error)
      toast({
        title: 'Error',
        description: 'Failed to load history',
        variant: 'destructive',
      })
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  // Initial load
  useEffect(() => {
    if (session?.user?.role === 'ADMIN') {
      fetchQueue()
    }
  }, [session])

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true)
    if (activeTab === 'queue') {
      await fetchQueue(false)
    } else {
      await fetchHistory(false)
    }
    setRefreshing(false)
  }

  // Handle tab change
  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    if (tab === 'history' && history.length === 0) {
      fetchHistory()
    }
  }

  if (!session?.user || session.user.role !== 'ADMIN') {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>Social Media Queue is only available to admin users.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Twitter className="h-5 w-5 text-blue-500" />
                Social Media Queue
              </CardTitle>
              <CardDescription>
                Manage and post alert images to Twitter/X
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="queue">
                Queue ({queue.length})
              </TabsTrigger>
              <TabsTrigger value="history">
                History ({history.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="queue" className="space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : queue.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Twitter className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground">No posts in queue</p>
                  <p className="text-sm text-muted-foreground/70">
                    Add alerts from the OI Alerts page
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {queue.map((post) => (
                    <QueuedPostCard
                      key={post.id}
                      post={post}
                      onUpdate={fetchQueue}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Twitter className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground">No posted tweets yet</p>
                  <p className="text-sm text-muted-foreground/70">
                    Posted tweets will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {history.map((post) => (
                    <HistoryCard key={post.id} post={post} />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

// Queued Post Card Component
function QueuedPostCard({ post, onUpdate }: { post: QueuedPostWithAlert; onUpdate: () => void }) {
  const { toast } = useToast()
  const [caption, setCaption] = useState(post.caption)
  const [isEditing, setIsEditing] = useState(false)
  const [isPosting, setIsPosting] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)

  const charCount = caption.length
  const isOverLimit = charCount > 280

  // Handle save caption
  const handleSave = async () => {
    try {
      await adminAPI.updateSocialMediaPost(post.id, { caption })
      toast({
        title: 'Caption updated',
        description: 'Changes saved successfully',
      })
      setIsEditing(false)
      onUpdate()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update caption',
        variant: 'destructive',
      })
    }
  }

  // Handle post to Twitter
  const handlePost = async () => {
    if (isOverLimit) {
      toast({
        title: 'Caption too long',
        description: 'Please reduce caption to 280 characters or less',
        variant: 'destructive',
      })
      return
    }

    setIsPosting(true)
    try {
      const response = await adminAPI.postToTwitter(post.id)
      toast({
        title: 'Posted to Twitter!',
        description: 'Tweet published successfully',
      })
      onUpdate()
    } catch (error: any) {
      toast({
        title: 'Failed to post',
        description: error.message || 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setIsPosting(false)
    }
  }

  // Handle reject
  const handleReject = async () => {
    setIsRejecting(true)
    try {
      await adminAPI.updateSocialMediaPost(post.id, { status: 'REJECTED' })
      toast({
        title: 'Post rejected',
        description: 'Removed from queue',
      })
      onUpdate()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reject post',
        variant: 'destructive',
      })
    } finally {
      setIsRejecting(false)
    }
  }

  const getAlertSymbol = () => {
    if (!post.alert) return 'Unknown'
    return (post.alert as any).symbol || 'Unknown'
  }

  const getAlertDetails = () => {
    if (!post.alert) return null
    if (post.alertType === 'VOLUME') {
      const alert = post.alert as any
      return `${alert.volumeRatio?.toFixed(2)}x volume spike`
    } else {
      const alert = post.alert as any
      return `${alert.pctChange ? (Number(alert.pctChange) * 100).toFixed(2) : 'N/A'}% OI change`
    }
  }

  return (
    <div className="border rounded-lg p-4 space-y-4">
      {/* Alert Info */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">{getAlertSymbol()}</span>
            <Badge variant="outline" className="text-xs">
              {post.alertType === 'VOLUME' ? 'Volume' : 'Open Interest'}
            </Badge>
            {post.status === 'FAILED' && (
              <Badge variant="destructive" className="text-xs">
                Failed
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {getAlertDetails()} • {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
          </p>
          {post.errorMessage && (
            <div className="flex items-center gap-2 mt-2 p-2 rounded bg-destructive/10 border border-destructive/20">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <p className="text-xs text-destructive">{post.errorMessage}</p>
            </div>
          )}
        </div>
      </div>

      {/* Image Preview */}
      {post.imageUrl && (
        <div className="relative w-full max-w-md">
          <img
            src={post.imageUrl}
            alt="Alert preview"
            className="w-full rounded-lg border"
          />
        </div>
      )}

      {/* Caption */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Caption</label>
          <span className={`text-xs ${isOverLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
            {charCount}/280
          </span>
        </div>
        {isEditing ? (
          <Textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="min-h-[100px] font-mono text-sm"
            placeholder="Enter tweet caption..."
          />
        ) : (
          <p className="text-sm p-3 rounded-lg bg-muted font-mono whitespace-pre-wrap">
            {caption}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {isEditing ? (
          <>
            <Button onClick={handleSave} size="sm" disabled={isOverLimit}>
              <Check className="h-4 w-4 mr-2" />
              Save
            </Button>
            <Button onClick={() => {
              setCaption(post.caption)
              setIsEditing(false)
            }} size="sm" variant="outline">
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button
              onClick={handlePost}
              size="sm"
              disabled={isPosting || isOverLimit}
            >
              {isPosting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Posting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Post to Twitter
                </>
              )}
            </Button>
            <Button onClick={() => setIsEditing(true)} size="sm" variant="outline">
              Edit Caption
            </Button>
            <Button
              onClick={handleReject}
              size="sm"
              variant="ghost"
              disabled={isRejecting}
            >
              {isRejecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <X className="h-4 w-4" />
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

// History Card Component
function HistoryCard({ post }: { post: QueuedPostWithAlert }) {
  const getAlertSymbol = () => {
    if (!post.alert) return 'Unknown'
    return (post.alert as any).symbol || 'Unknown'
  }

  const getAlertDetails = () => {
    if (!post.alert) return null
    if (post.alertType === 'VOLUME') {
      const alert = post.alert as any
      return `${alert.volumeRatio?.toFixed(2)}x volume spike`
    } else {
      const alert = post.alert as any
      return `${alert.pctChange ? (Number(alert.pctChange) * 100).toFixed(2) : 'N/A'}% OI change`
    }
  }

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{getAlertSymbol()}</span>
            <Badge variant="outline" className="text-xs">
              {post.alertType === 'VOLUME' ? 'Volume' : 'Open Interest'}
            </Badge>
            <Badge variant="secondary" className="text-xs gap-1">
              <Check className="h-3 w-3" />
              Posted
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {getAlertDetails()} • {post.postedAt ? formatDistanceToNow(new Date(post.postedAt), { addSuffix: true }) : 'Recently'}
          </p>
        </div>
        {post.twitterUrl && (
          <Button asChild size="sm" variant="outline">
            <Link href={post.twitterUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              View Tweet
            </Link>
          </Button>
        )}
      </div>

      {/* Image thumbnail */}
      {post.imageUrl && (
        <div className="relative w-32 h-20">
          <img
            src={post.imageUrl}
            alt="Posted alert"
            className="w-full h-full object-cover rounded border"
          />
        </div>
      )}

      {/* Caption preview */}
      <p className="text-sm text-muted-foreground line-clamp-2 font-mono">
        {post.caption}
      </p>
    </div>
  )
}
