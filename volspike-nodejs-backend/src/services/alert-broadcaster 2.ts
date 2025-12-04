import type { Server as SocketIOServer } from 'socket.io'
import type { VolumeAlert, OpenInterestAlert } from '@prisma/client'

let ioInstance: SocketIOServer | null = null
const alertQueues: {
  free: VolumeAlert[]
  pro: VolumeAlert[]
} = {
  free: [],
  pro: []
}

export function setSocketIO(io: SocketIOServer) {
  ioInstance = io
  startTierBasedBroadcasting()
}

/**
 * Broadcast user deletion event to force immediate logout
 * This ensures deleted users are logged out immediately via WebSocket
 */
export async function broadcastUserDeletion(userId: string, reason: 'deleted' | 'banned' | 'suspended' = 'deleted') {
  if (!ioInstance) {
    console.warn('[UserDeletion] Socket.IO not initialized, cannot broadcast deletion')
    return
  }

  console.log(`[UserDeletion] Broadcasting ${reason} event to user ${userId}`)
  
  const deletionPayload = {
    userId,
    reason,
    timestamp: new Date().toISOString(),
    message: reason === 'deleted' 
      ? 'Your account has been permanently deleted.'
      : reason === 'banned'
      ? 'Your account has been banned.'
      : 'Your account has been suspended.'
  }
  
  // Broadcast to user's room
  ioInstance.to(`user-${userId}`).emit('user-deleted', deletionPayload)
  
  // Also disconnect all sockets for this user to force immediate logout
  try {
    const sockets = await ioInstance.in(`user-${userId}`).fetchSockets()
    sockets.forEach(socket => {
      socket.emit('user-deleted', deletionPayload)
      socket.disconnect(true)
    })
    console.log(`[UserDeletion] Disconnected ${sockets.length} socket(s) for user ${userId}`)
  } catch (error) {
    console.error('[UserDeletion] Error disconnecting sockets:', error)
  }
}

export function broadcastVolumeAlert(alert: VolumeAlert) {
  if (!ioInstance) {
    console.warn('Socket.IO not initialized, skipping broadcast')
    return
  }

  // Use detectionTime (when detected on DO) or fallback to timestamp
  const alertTime = alert.detectionTime || alert.timestamp
  const alertMinute = alertTime.getMinutes()

  // Elite tier: broadcast immediately (real-time)
  ioInstance.to('tier-elite').emit('volume-alert', alert)
  console.log(`📢 Broadcasted to Elite tier: ${alert.asset} (${alert.volumeRatio.toFixed(2)}x)`)

  // Pro tier: Check if alert was detected at a 5-minute interval
  // If yes, broadcast immediately; otherwise queue for next interval
  const isProInterval = alertMinute % 5 === 0
  if (isProInterval) {
    ioInstance.to('tier-pro').emit('volume-alert', alert)
    console.log(`📢 Immediately broadcasted to Pro tier: ${alert.asset} (detected at :${alertMinute.toString().padStart(2, '0')})`)
  } else {
    alertQueues.pro.push(alert)
  }

  // Free tier: Check if alert was detected at a 15-minute interval
  // If yes, broadcast immediately; otherwise queue for next interval
  const isFreeInterval = alertMinute % 15 === 0
  if (isFreeInterval) {
    ioInstance.to('tier-free').emit('volume-alert', alert)
    console.log(`📢 Immediately broadcasted to Free tier: ${alert.asset} (detected at :${alertMinute.toString().padStart(2, '0')})`)
  } else {
    alertQueues.free.push(alert)
  }
}

function startTierBasedBroadcasting() {
  if (!ioInstance) return
  
  // Helper to check if current time matches wall-clock interval
  const isAtInterval = (minutes: number): boolean => {
    const now = new Date()
    return now.getMinutes() % minutes === 0 && now.getSeconds() === 0
  }
  
  // Check every second for wall-clock alignment
  setInterval(() => {
    if (!ioInstance) return
    
    const io = ioInstance
    
    // Pro tier: broadcast at :00, :05, :10, :15, :20, etc.
    if (isAtInterval(5)) {
      if (alertQueues.pro.length > 0) {
        alertQueues.pro.forEach(alert => {
          io.to('tier-pro').emit('volume-alert', alert)
        })
        console.log(`📢 [${new Date().toISOString()}] Broadcasted ${alertQueues.pro.length} alerts to Pro tier`)
        alertQueues.pro = []
      }
    }
    
    // Free tier: broadcast at :00, :15, :30, :45
    if (isAtInterval(15)) {
      if (alertQueues.free.length > 0) {
        alertQueues.free.forEach(alert => {
          io.to('tier-free').emit('volume-alert', alert)
        })
        console.log(`📢 [${new Date().toISOString()}] Broadcasted ${alertQueues.free.length} alerts to Free tier`)
        alertQueues.free = []
      }
    }
  }, 1000) // Check every second for wall-clock alignment
}

/**
 * Broadcast Open Interest alert to WebSocket clients
 * Available to Pro/Elite tiers and Admin users
 * Free tier users cannot access OI alerts
 */
export function broadcastOpenInterestAlert(alert: OpenInterestAlert) {
  if (!ioInstance) {
    console.warn('Socket.IO not initialized, skipping OI alert broadcast')
    return
  }

  const pctChangeNum = typeof alert.pctChange === 'number' ? alert.pctChange : Number(alert.pctChange)

  // Broadcast to admin room (for admin panel)
  ioInstance.to('role-admin').emit('open-interest-alert', alert)

  // Broadcast to Pro and Elite tiers (user dashboard feature)
  ioInstance.to('tier-pro').emit('open-interest-alert', alert)
  ioInstance.to('tier-elite').emit('open-interest-alert', alert)

  console.log(`📢 Broadcasted OI alert: ${alert.symbol} ${alert.direction} (${(pctChangeNum * 100).toFixed(2)}%) to admin/pro/elite`)
}

/**
 * Broadcast Open Interest update to WebSocket clients
 * Used when new OI data is ingested (realtime or snapshot)
 */
export function broadcastOpenInterestUpdate(symbol: string, openInterest: number, openInterestUsd: number | null, source: string) {
  if (!ioInstance) {
    console.warn('Socket.IO not initialized, skipping OI update broadcast')
    return
  }

  const update = {
    symbol,
    openInterest,
    openInterestUsd,
    source,
    timestamp: new Date().toISOString(),
  }

  // Broadcast to all tiers (OI updates are less frequent than alerts)
  ioInstance.to('tier-elite').emit('open-interest-update', update)
  ioInstance.to('tier-pro').emit('open-interest-update', update)
  ioInstance.to('tier-free').emit('open-interest-update', update)
}

