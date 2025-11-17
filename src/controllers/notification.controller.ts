import { NextFunction, Request, Response } from 'express'
import { ParamsDictionary } from 'express-serve-static-core'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import { NOTIFICATION_MESSAGES } from '~/constants/messages'
import notificationService from '~/services/notification.service'
import { NotificationType } from '~/constants/enum'

/**
 * Lấy danh sách notifications của user
 * GET /api/notifications
 */
export const getNotifications = async (
  req: Request<ParamsDictionary, any, any, { page?: string; limit?: string; isRead?: string; type?: string }>,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.decoded_authorization?.user_id
    if (!userId) {
      return res.status(HTTP_STATUS_CODE.UNAUTHORIZED).json({
        message: 'Unauthorized'
      })
    }

    const page = req.query.page ? parseInt(req.query.page) : 1
    const limit = req.query.limit ? parseInt(req.query.limit) : 20
    const isRead = req.query.isRead === 'true' ? true : req.query.isRead === 'false' ? false : undefined
    const type = req.query.type as NotificationType | undefined

    const result = await notificationService.getNotifications(userId, {
      page,
      limit,
      isRead,
      type
    })

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: NOTIFICATION_MESSAGES.GET_NOTIFICATIONS_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Đếm số notification chưa đọc
 * GET /api/notifications/unread-count
 */
export const getUnreadCount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.decoded_authorization?.user_id
    if (!userId) {
      return res.status(HTTP_STATUS_CODE.UNAUTHORIZED).json({
        message: 'Unauthorized'
      })
    }

    const count = await notificationService.getUnreadCount(userId)

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: NOTIFICATION_MESSAGES.GET_UNREAD_COUNT_SUCCESS,
      result: { count }
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Đánh dấu 1 notification đã đọc
 * PUT /api/notifications/:id/read
 */
export const markAsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.decoded_authorization?.user_id
    if (!userId) {
      return res.status(HTTP_STATUS_CODE.UNAUTHORIZED).json({
        message: 'Unauthorized'
      })
    }

    const { id } = req.params
    const modifiedCount = await notificationService.markAsRead(id, userId)

    if (modifiedCount === 0) {
      return res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
        message: NOTIFICATION_MESSAGES.NOTIFICATION_NOT_FOUND
      })
    }

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: NOTIFICATION_MESSAGES.MARK_AS_READ_SUCCESS
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Đánh dấu tất cả notifications đã đọc
 * PUT /api/notifications/read-all
 */
export const markAllAsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.decoded_authorization?.user_id
    if (!userId) {
      return res.status(HTTP_STATUS_CODE.UNAUTHORIZED).json({
        message: 'Unauthorized'
      })
    }

    const modifiedCount = await notificationService.markAllAsRead(userId)

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: NOTIFICATION_MESSAGES.MARK_ALL_AS_READ_SUCCESS,
      result: { modifiedCount }
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Xóa notification
 * DELETE /api/notifications/:id
 */
export const deleteNotification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.decoded_authorization?.user_id
    if (!userId) {
      return res.status(HTTP_STATUS_CODE.UNAUTHORIZED).json({
        message: 'Unauthorized'
      })
    }

    const { id } = req.params
    const deletedCount = await notificationService.deleteNotification(id, userId)

    if (deletedCount === 0) {
      return res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
        message: NOTIFICATION_MESSAGES.NOTIFICATION_NOT_FOUND
      })
    }

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: NOTIFICATION_MESSAGES.DELETE_NOTIFICATION_SUCCESS
    })
  } catch (error) {
    next(error)
  }
}

