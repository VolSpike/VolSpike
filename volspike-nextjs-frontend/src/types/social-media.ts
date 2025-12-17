export type SocialMediaStatus = 'QUEUED' | 'POSTING' | 'POSTED' | 'FAILED' | 'REJECTED'
export type AlertSourceType = 'VOLUME' | 'OPEN_INTEREST'

export interface SocialMediaPost {
  id: string
  alertId: string
  alertType: AlertSourceType
  imageUrl: string | null
  caption: string
  suggestedCaption: string | null
  status: SocialMediaStatus
  twitterPostId: string | null
  twitterUrl: string | null
  createdById: string
  postedById: string | null
  errorMessage: string | null
  retryCount: number
  createdAt: string
  postedAt: string | null
  updatedAt: string
}

export interface VolumeAlert {
  id: string
  symbol: string
  asset: string
  currentVolume: number
  previousVolume: number
  volumeRatio: number
  price: number | null
  priceChange: number | null
  fundingRate: number | null
  oiChange: number | null
  alertType: string
  message: string
  timestamp: string
  hourTimestamp: string
  isUpdate: boolean
  candleDirection: string | null
  detectionTime: string | null
}

export interface OpenInterestAlert {
  id: string
  symbol: string
  direction: string
  baseline: string
  current: string
  pctChange: string
  absChange: string
  priceChange: string | null
  fundingRate: string | null
  timeframe: string
  source: string
  ts: string
  createdAt: string
}

export interface QueuedPostWithAlert extends SocialMediaPost {
  alert: VolumeAlert | OpenInterestAlert | null
}

export interface CreateSocialMediaPostRequest {
  alertId: string
  alertType: AlertSourceType
  imageUrl: string
  caption?: string
}

export interface UpdateSocialMediaPostRequest {
  caption?: string
  status?: 'QUEUED' | 'REJECTED'
}

export interface PostToTwitterResponse {
  success: boolean
  twitterPostId?: string
  twitterUrl?: string
  error?: string
}

export interface GetQueueParams {
  status?: SocialMediaStatus
  limit?: number
  offset?: number
}

export interface GetHistoryParams {
  limit?: number
  offset?: number
  symbol?: string
  startDate?: string
  endDate?: string
}

export interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  pagination: {
    total: number
    limit: number
    offset: number
  }
}
