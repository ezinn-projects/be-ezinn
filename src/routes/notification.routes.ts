import { Router } from 'express'
import { UserRole } from '~/constants/enum'
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification
} from '~/controllers/notification.controller'
import { protect } from '~/middlewares/auth.middleware'

const notificationRoutes = Router()

/**
 * Description: Get notifications list
 * Path: /api/notifications
 * Method: GET
 * Query: page, limit, isRead, type
 */
notificationRoutes.get('/', protect([UserRole.Admin, UserRole.Staff]), getNotifications)

/**
 * Description: Get unread count
 * Path: /api/notifications/unread-count
 * Method: GET
 */
notificationRoutes.get('/unread-count', protect([UserRole.Admin, UserRole.Staff]), getUnreadCount)

/**
 * Description: Mark all as read
 * Path: /api/notifications/read-all
 * Method: PUT
 */
notificationRoutes.put('/read-all', protect([UserRole.Admin, UserRole.Staff]), markAllAsRead)

/**
 * Description: Mark as read
 * Path: /api/notifications/:id/read
 * Method: PUT
 */
notificationRoutes.put('/:id/read', protect([UserRole.Admin, UserRole.Staff]), markAsRead)

/**
 * Description: Delete notification
 * Path: /api/notifications/:id
 * Method: DELETE
 */
notificationRoutes.delete('/:id', protect([UserRole.Admin, UserRole.Staff]), deleteNotification)

export default notificationRoutes
