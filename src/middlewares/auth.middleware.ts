import { NextFunction, Request, Response } from 'express'
import { UserRole } from '~/constants/enum'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import { AUTH_MESSAGES } from '~/constants/messages'
import { ErrorWithStatus } from '~/models/Error'
import { usersServices } from '~/services/users.services'
import { verifyToken } from '~/utils/jwt'

export const protect = (roles: UserRole[]) => async (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers['authorization']?.split(' ')[1]

  if (!token) {
    return next(
      new ErrorWithStatus({
        message: AUTH_MESSAGES.ACCESS_TOKEN_NOT_EMPTY,
        status: HTTP_STATUS_CODE.UNAUTHORIZED
      })
    )
  }

  try {
    const decoded = await verifyToken(token)

    req.decoded_authorization = decoded

    const user = await usersServices.getUserById(decoded.user_id)

    // Kiểm tra quyền hạn (nếu roles được cung cấp)
    if (roles.length && !roles.includes(user?.role || UserRole.User)) {
      return next(
        new ErrorWithStatus({
          message: AUTH_MESSAGES.ACCESS_DENIED,
          status: HTTP_STATUS_CODE.FORBIDDEN
        })
      )
    }

    next()
  } catch (error) {
    next(
      new ErrorWithStatus({
        message: AUTH_MESSAGES.INVALID_TOKEN,
        status: HTTP_STATUS_CODE.UNAUTHORIZED
      })
    )
  }
}
