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

