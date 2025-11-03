import type { Server as SocketIOServer } from 'socket.io'
import type { VolumeAlert } from '@prisma/client'

let ioInstance: SocketIOServer | null = null

export function setSocketIO(io: SocketIOServer) {
  ioInstance = io
}

export function broadcastVolumeAlert(alert: VolumeAlert) {
  if (!ioInstance) {
    console.warn('Socket.IO not initialized, skipping broadcast')
    return
  }

  // Broadcast to all connected clients
  ioInstance.emit('volume-alert', alert)
  
  console.log(`📢 Broadcasted volume alert: ${alert.asset} (${alert.volumeRatio.toFixed(2)}x)`)
}

