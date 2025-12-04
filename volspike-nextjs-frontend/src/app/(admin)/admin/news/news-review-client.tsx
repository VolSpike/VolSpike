'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatDistanceToNow } from 'date-fns'
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Newspaper,
  Clock,
  Filter,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AdminPageHeader } from '@/components/admin/layout/admin-page-header'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface RssFeed {
  id: string
  name: string
  url: string
  category: string
  enabled: boolean
  priority: number
  lastFetchAt: string | null
  errorCount: number
  lastError: string | null
  _count?: {
    articles: number
  }
}

interface RssArticle {
  id: string
  title: string
  link: string
  pubDate: string
  description: string | null
  author: string | null
  categories: string[]
  enclosure: string | null
  createdAt: string
  feed: RssFeed
}

interface NewsStats {
  totalFeeds: number
  enabledFeeds: number
  totalArticles: number
  oldestArticle?: string
  newestArticle?: string
  feedsWithErrors: number
}

interface NewsReviewClientProps {
  accessToken: string
}

export function NewsReviewClient({ accessToken }: NewsReviewClientProps) {
  const [feeds, setFeeds] = useState<RssFeed[]>([])
  const [articles, setArticles] = useState<RssArticle[]>([])
  const [stats, setStats] = useState<NewsStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState<Record<string, boolean>>({})
  const [expandedFeeds, setExpandedFeeds] = useState<Record<string, boolean>>({})
  const [selectedFeed, setSelectedFeed] = useState<string>('all')
  const [seeding, setSeeding] = useState(false)
  const [refreshingAll, setRefreshingAll] = useState(false)
  const [cleaningUp, setCleaningUp] = useState(false)

  const fetchFeeds = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/news/feeds`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
      if (response.ok) {
        const data = await response.json()
        setFeeds(data.feeds || [])
      }
    } catch (error) {
      console.error('Failed to fetch feeds:', error)
    }
  }, [accessToken])

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/news/stats`, {
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

  const fetchArticles = useCallback(
    async (feedId?: string) => {
      try {
        const params = new URLSearchParams({ limit: '100' })
        if (feedId && feedId !== 'all') {
          params.set('feedId', feedId)
        }

        const response = await fetch(`${API_BASE_URL}/api/admin/news/articles?${params}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })
        if (response.ok) {
          const data = await response.json()
          setArticles(data.articles || [])
        }
      } catch (error) {
        console.error('Failed to fetch articles:', error)
      }
    },
    [accessToken]
  )

  const refreshFeed = async (feedId: string) => {
    setRefreshing((prev) => ({ ...prev, [feedId]: true }))
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/news/feeds/${feedId}/refresh`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
      if (response.ok) {
        await fetchFeeds()
        await fetchStats()
        await fetchArticles(selectedFeed)
      }
    } catch (error) {
      console.error('Failed to refresh feed:', error)
    } finally {
      setRefreshing((prev) => ({ ...prev, [feedId]: false }))
    }
  }

  const toggleFeed = async (feedId: string, enabled: boolean) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/news/feeds/${feedId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled }),
      })
      if (response.ok) {
        await fetchFeeds()
      }
    } catch (error) {
      console.error('Failed to toggle feed:', error)
    }
  }

  const seedFeeds = async () => {
    setSeeding(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/news/seed`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
      if (response.ok) {
        await fetchFeeds()
        await fetchStats()
      }
    } catch (error) {
      console.error('Failed to seed feeds:', error)
    } finally {
      setSeeding(false)
    }
  }

  const refreshAllFeeds = async () => {
    setRefreshingAll(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/news/refresh-all`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
      if (response.ok) {
        await fetchFeeds()
        await fetchStats()
        await fetchArticles(selectedFeed)
      }
    } catch (error) {
      console.error('Failed to refresh all feeds:', error)
    } finally {
      setRefreshingAll(false)
    }
  }

  const cleanupOldArticles = async () => {
    setCleaningUp(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/news/cleanup`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ hoursToKeep: 6 }),
      })
      if (response.ok) {
        const data = await response.json()
        alert(`Deleted ${data.deleted} old articles`)
        await fetchStats()
        await fetchArticles(selectedFeed)
      }
    } catch (error) {
      console.error('Failed to cleanup articles:', error)
    } finally {
      setCleaningUp(false)
    }
  }

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([fetchFeeds(), fetchStats(), fetchArticles()])
      setLoading(false)
    }
    loadData()
  }, [fetchFeeds, fetchStats, fetchArticles])

  useEffect(() => {
    fetchArticles(selectedFeed)
  }, [selectedFeed, fetchArticles])

  const toggleExpand = (feedId: string) => {
    setExpandedFeeds((prev) => ({ ...prev, [feedId]: !prev[feedId] }))
  }

  const getFeedStatusIcon = (feed: RssFeed) => {
    if (feed.errorCount > 0) {
      return <AlertCircle className="w-5 h-5 text-yellow-500" />
    }
    if (feed.enabled) {
      return <CheckCircle className="w-5 h-5 text-green-500" />
    }
    return <XCircle className="w-5 h-5 text-gray-400" />
  }

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'Regulatory/Macro': 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
      'Global Coverage': 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
      'On-chain/Whale': 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
      Investigative: 'bg-gray-500/10 text-gray-700 dark:text-gray-400',
      'DeFi/NFT': 'bg-green-500/10 text-green-700 dark:text-green-400',
      'Price Action': 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
      'ETH/Ripple': 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
      'BTC Macro': 'bg-orange-600/10 text-orange-800 dark:text-orange-300',
      'AI-Curated': 'bg-pink-500/10 text-pink-700 dark:text-pink-400',
      Aggregated: 'bg-red-500/10 text-red-700 dark:text-red-400',
      'Macro Crossover': 'bg-purple-600/10 text-purple-800 dark:text-purple-300',
      General: 'bg-slate-500/10 text-slate-700 dark:text-slate-400',
    }
    return colors[category] || 'bg-gray-500/10 text-gray-700 dark:text-gray-400'
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          title="News Feeds"
          description="Loading RSS news feed data..."
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
        title="News Feeds"
        description="Review and manage RSS news feed sources. Test feeds before enabling them for production."
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats?.totalFeeds || 0}</div>
            <p className="text-xs text-muted-foreground">Total Feeds</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{stats?.enabledFeeds || 0}</div>
            <p className="text-xs text-muted-foreground">Enabled Feeds</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats?.totalArticles || 0}</div>
            <p className="text-xs text-muted-foreground">Total Articles</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-600">{stats?.feedsWithErrors || 0}</div>
            <p className="text-xs text-muted-foreground">Feeds with Errors</p>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        {feeds.length === 0 && (
          <Button onClick={seedFeeds} disabled={seeding}>
            {seeding ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Newspaper className="w-4 h-4 mr-2" />
            )}
            Seed RSS Feeds
          </Button>
        )}
        <Button onClick={refreshAllFeeds} disabled={refreshingAll} variant="outline">
          {refreshingAll ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Refresh All Feeds
        </Button>
        <Button onClick={cleanupOldArticles} disabled={cleaningUp} variant="outline">
          {cleaningUp ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4 mr-2" />
          )}
          Cleanup Old Articles (6h)
        </Button>
      </div>

      {/* Feeds Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Newspaper className="w-5 h-5" />
            RSS Feed Sources ({feeds.length})
          </CardTitle>
          <CardDescription>
            Click on a feed to expand and see recent articles. Toggle to enable/disable for production.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {feeds.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No feeds configured. Click "Seed RSS Feeds" to add the default sources.
            </div>
          ) : (
            feeds.map((feed) => (
              <div
                key={feed.id}
                className="border rounded-lg overflow-hidden bg-card hover:border-brand-500/40 transition-colors"
              >
                {/* Feed Header */}
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {getFeedStatusIcon(feed)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{feed.name}</span>
                        <Badge variant="outline" className={getCategoryColor(feed.category)}>
                          {feed.category}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {feed._count?.articles || 0} articles
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 truncate">
                        {feed.url}
                      </div>
                      {feed.lastFetchAt && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3" />
                          Last fetched: {formatDistanceToNow(new Date(feed.lastFetchAt), { addSuffix: true })}
                        </div>
                      )}
                      {feed.errorCount > 0 && (
                        <div className="text-xs text-yellow-600 mt-1">
                          {feed.errorCount} error(s) - {feed.lastError}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {feed.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                      <Switch
                        checked={feed.enabled}
                        onCheckedChange={(checked) => toggleFeed(feed.id, checked)}
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => refreshFeed(feed.id)}
                      disabled={refreshing[feed.id]}
                    >
                      {refreshing[feed.id] ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleExpand(feed.id)}
                    >
                      {expandedFeeds[feed.id] ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Expanded Articles Preview */}
                {expandedFeeds[feed.id] && (
                  <div className="border-t bg-muted/30 p-4">
                    <div className="text-sm font-medium mb-3">Recent Articles from {feed.name}:</div>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {articles
                        .filter((a) => a.feed.id === feed.id)
                        .slice(0, 10)
                        .map((article) => (
                          <a
                            key={article.id}
                            href={article.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block p-3 rounded-md bg-card border hover:border-brand-500/40 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm line-clamp-2">
                                  {article.title}
                                </div>
                                {article.description && (
                                  <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                    {article.description}
                                  </div>
                                )}
                                <div className="text-xs text-muted-foreground mt-2 flex items-center gap-2">
                                  <Clock className="w-3 h-3" />
                                  {formatDistanceToNow(new Date(article.pubDate), { addSuffix: true })}
                                  {article.author && (
                                    <>
                                      <span>by</span>
                                      <span className="font-medium">{article.author}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            </div>
                          </a>
                        ))}
                      {articles.filter((a) => a.feed.id === feed.id).length === 0 && (
                        <div className="text-sm text-muted-foreground text-center py-4">
                          No articles yet. Click refresh to fetch articles from this feed.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* All Articles Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Article Feed ({articles.length})
              </CardTitle>
              <CardDescription>
                Browse all articles from all sources. Filter by feed to focus on specific sources.
              </CardDescription>
            </div>
            <Select value={selectedFeed} onValueChange={setSelectedFeed}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by feed" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Feeds</SelectItem>
                {feeds.map((feed) => (
                  <SelectItem key={feed.id} value={feed.id}>
                    {feed.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {articles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No articles available. Refresh feeds to fetch the latest news.
              </div>
            ) : (
              articles.map((article) => (
                <a
                  key={article.id}
                  href={article.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-4 rounded-lg border bg-card hover:border-brand-500/40 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start gap-4">
                    {article.enclosure && (
                      <img
                        src={article.enclosure}
                        alt=""
                        className="w-20 h-20 object-cover rounded-md flex-shrink-0"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant="outline" className={getCategoryColor(article.feed.category)}>
                          {article.feed.name}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(article.pubDate), { addSuffix: true })}
                        </span>
                      </div>
                      <h3 className="font-semibold text-sm line-clamp-2 mb-1">{article.title}</h3>
                      {article.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {article.description}
                        </p>
                      )}
                      {article.categories.length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {article.categories.slice(0, 3).map((cat, i) => (
                            <span
                              key={i}
                              className="text-xs bg-muted/50 px-2 py-0.5 rounded"
                            >
                              #{cat}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </div>
                </a>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
