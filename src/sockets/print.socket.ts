import { Server } from 'socket.io'

export const PrintSocket = (io: Server) => {
  io.on('connection', (socket) => {
    console.log('Client connected to print socket:', socket.id)
    socket.on('join-room', ({ printerId }) => {
      console.log(`[Socket] ${socket.id} joining room printer:${printerId}`)
      socket.join(`printer:${printerId}`)
    })

    socket.on('disconnect', () => {
      console.log(`[Socket] Disconnected: ${socket.id}`)
    })
  })
}
