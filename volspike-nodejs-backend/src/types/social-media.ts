import type { SocialMediaPost as PrismaSocialMediaPost, SocialMediaStatus, AlertSourceType } from '@prisma/client'
import type { VolumeAlert, OpenInterestAlert } from '@prisma/client'

export type { SocialMediaStatus, AlertSourceType }

export interface SocialMediaPost extends PrismaSocialMediaPost {}

export interface QueuedPostWithVolumeAlert extends SocialMediaPost {
  alert: VolumeAlert
}

export interface QueuedPostWithOIAlert extends SocialMediaPost {
  alert: OpenInterestAlert
}

export type QueuedPostWithAlert = QueuedPostWithVolumeAlert | QueuedPostWithOIAlert

export interface CreateSocialMediaPostRequest {
  alertId: string
  alertType: 'VOLUME' | 'OPEN_INTEREST'
  imageUrl: string
  caption?: string // Optional, will auto-generate if not provided
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
