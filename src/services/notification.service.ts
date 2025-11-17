import { ObjectId } from 'mongodb'
import { NotificationType } from '~/constants/enum'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import { NOTIFICATION_MESSAGES } from '~/constants/messages'
import { ErrorWithStatus } from '~/models/Error'
import { Notification, INotification } from '~/models/schemas/Notification.schema'
import databaseService from './database.service'
import { EventEmitter } from 'events'

// EventEmitter cho notification events
export const notificationEventEmitter = new EventEmitter()

interface IGetNotificationsOptions {
  page?: number
  limit?: number
  isRead?: boolean
  type?: NotificationType
}

interface IGetNotificationsResult {
  notifications: INotification[]
  total: number
  page: number
  limit: number
  totalPages: number
}

class NotificationService {
  /**
   * Tạo notification mới và lưu vào DB
   */
  async createNotification(
    userId: string | ObjectId,
    title: string,
    body: string,
    type: NotificationType,
    data?: any
  ): Promise<INotification> {
    const notification = new Notification({
      userId: new ObjectId(userId),
      title,
      body,
      type,
      data,
      isRead: false,
      createdAt: new Date()
    })

    const result = await databaseService.notifications.insertOne(notification)
    const createdNotification = { ...notification, _id: result.insertedId }

    // Emit event để socket handler có thể gửi realtime notification
    notificationEventEmitter.emit('notification_created', {
      userId: userId.toString(),
      notification: createdNotification
    })

    return createdNotification
  }

  /**
   * Tạo notification cho nhiều users (bulk create)
   * Dùng cho trường hợp notify tất cả admin
   */
  async createNotificationForMultipleUsers(
    userIds: string[],
    title: string,
    body: string,
    type: NotificationType,
    data?: any
  ): Promise<INotification[]> {
    const notifications: Notification[] = userIds.map(
      (userId) =>
        new Notification({
          userId: new ObjectId(userId),
          title,
          body,
          type,
          data,
          isRead: false,
          createdAt: new Date()
        })
    )

    if (notifications.length === 0) {
      return []
    }

    const result = await databaseService.notifications.insertMany(notifications)
    const createdNotifications = notifications.map((notification, index) => ({
      ...notification,
      _id: result.insertedIds[index]
    }))

    // Emit events cho từng user
    createdNotifications.forEach((notification) => {
      notificationEventEmitter.emit('notification_created', {
        userId: notification.userId.toString(),
        notification
      })
    })

    return createdNotifications
  }

  /**
   * Lấy danh sách notifications của user với pagination và filters
   */
  async getNotifications(userId: string, options: IGetNotificationsOptions = {}): Promise<IGetNotificationsResult> {
    const { page = 1, limit = 20, isRead, type } = options

    // Build query
    const query: any = {
      userId: new ObjectId(userId)
    }

    if (isRead !== undefined) {
      query.isRead = isRead
    }

    if (type) {
      query.type = type
    }

    // Get total count
    const total = await databaseService.notifications.countDocuments(query)

    // Get notifications with pagination
    const notifications = await databaseService.notifications
      .find(query)
      .sort({ createdAt: -1 }) // Mới nhất trước
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray()

    return {
      notifications,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  }

  /**
   * Đếm số notification chưa đọc
   */
  async getUnreadCount(userId: string): Promise<number> {
    return await databaseService.notifications.countDocuments({
      userId: new ObjectId(userId),
      isRead: false
    })
  }

  /**
   * Đánh dấu 1 notification đã đọc
   */
  async markAsRead(notificationId: string, userId: string): Promise<number> {
    if (!ObjectId.isValid(notificationId)) {
      throw new ErrorWithStatus({
        message: NOTIFICATION_MESSAGES.NOTIFICATION_NOT_FOUND,
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
    }

    const notification = await databaseService.notifications.findOne({
      _id: new ObjectId(notificationId)
    })

    if (!notification) {
      throw new ErrorWithStatus({
        message: NOTIFICATION_MESSAGES.NOTIFICATION_NOT_FOUND,
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
    }

    // Verify ownership
    if (notification.userId.toString() !== userId) {
      throw new ErrorWithStatus({
        message: NOTIFICATION_MESSAGES.UNAUTHORIZED_ACCESS,
        status: HTTP_STATUS_CODE.FORBIDDEN
      })
    }

    const result = await databaseService.notifications.updateOne(
      { _id: new ObjectId(notificationId) },
      { $set: { isRead: true } }
    )

    return result.modifiedCount
  }

  /**
   * Đánh dấu tất cả notifications đã đọc
   */
  async markAllAsRead(userId: string): Promise<number> {
    const result = await databaseService.notifications.updateMany(
      {
        userId: new ObjectId(userId),
        isRead: false
      },
      { $set: { isRead: true } }
    )

    return result.modifiedCount
  }

  /**
   * Xóa notification
   */
  async deleteNotification(notificationId: string, userId: string): Promise<number> {
    if (!ObjectId.isValid(notificationId)) {
      throw new ErrorWithStatus({
        message: NOTIFICATION_MESSAGES.NOTIFICATION_NOT_FOUND,
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
    }

    const notification = await databaseService.notifications.findOne({
      _id: new ObjectId(notificationId)
    })

    if (!notification) {
      throw new ErrorWithStatus({
        message: NOTIFICATION_MESSAGES.NOTIFICATION_NOT_FOUND,
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
    }

    // Verify ownership
    if (notification.userId.toString() !== userId) {
      throw new ErrorWithStatus({
        message: NOTIFICATION_MESSAGES.UNAUTHORIZED_ACCESS,
        status: HTTP_STATUS_CODE.FORBIDDEN
      })
    }

    const result = await databaseService.notifications.deleteOne({
      _id: new ObjectId(notificationId)
    })

    return result.deletedCount
  }

  /**
   * Helper: Format notification message với placeholders
   */
  formatMessage(template: string, data: Record<string, any>): string {
    let result = template
    Object.keys(data).forEach((key) => {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), data[key])
    })
    return result
  }
}

const notificationService = new NotificationService()
export default notificationService

