import type { Server as SocketIOServer } from 'socket.io'
import type { VolumeAlert } from '@prisma/client'

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

export function broadcastVolumeAlert(alert: VolumeAlert) {
  if (!ioInstance) {
    console.warn('Socket.IO not initialized, skipping broadcast')
    return
  }

  // Elite tier: broadcast immediately (real-time)
  ioInstance.to('tier-elite').emit('volume-alert', alert)
  console.log(`📢 Broadcasted to Elite tier: ${alert.asset} (${alert.volumeRatio.toFixed(2)}x)`)
  
  // Pro tier: queue for 5-minute batch
  alertQueues.pro.push(alert)
  
  // Free tier: queue for 15-minute batch
  alertQueues.free.push(alert)
}

function startTierBasedBroadcasting() {
  if (!ioInstance) return
  
  // Pro tier: every 5 minutes
  setInterval(() => {
    if (alertQueues.pro.length > 0 && ioInstance) {
      const io = ioInstance // Capture in local variable for TypeScript
      alertQueues.pro.forEach(alert => {
        io.to('tier-pro').emit('volume-alert', alert)
      })
      console.log(`📢 Broadcasted ${alertQueues.pro.length} alerts to Pro tier`)
      alertQueues.pro = []
    }
  }, 5 * 60 * 1000) // 5 minutes
  
  // Free tier: every 15 minutes
  setInterval(() => {
    if (alertQueues.free.length > 0 && ioInstance) {
      const io = ioInstance // Capture in local variable for TypeScript
      alertQueues.free.forEach(alert => {
        io.to('tier-free').emit('volume-alert', alert)
      })
      console.log(`📢 Broadcasted ${alertQueues.free.length} alerts to Free tier`)
      alertQueues.free = []
    }
  }, 15 * 60 * 1000) // 15 minutes
}

