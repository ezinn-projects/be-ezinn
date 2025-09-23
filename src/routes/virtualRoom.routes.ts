import { Router } from 'express'
import {
  getVirtualRoomDashboard,
  updateVirtualRoomList,
  getVirtualRooms,
  recreateVirtualRooms
} from '~/controllers/virtualRoom.controller'

const virtualRoomRoutes = Router()

// Admin routes
virtualRoomRoutes.get('/dashboard', getVirtualRoomDashboard)
virtualRoomRoutes.get('/', getVirtualRooms)
virtualRoomRoutes.post('/update', updateVirtualRoomList)
virtualRoomRoutes.post('/recreate', recreateVirtualRooms)

export default virtualRoomRoutes
