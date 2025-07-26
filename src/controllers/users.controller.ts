import { NextFunction, Request, Response } from 'express'
import { type ParamsDictionary } from 'express-serve-static-core'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import { USER_MESSAGES } from '~/constants/messages'
import { type RegisterRequestBody, UpdateUserRequestBody, GetUsersQuery } from '~/models/requests/User.requests'
import { usersServices } from '~/services/users.services'
import { hashPassword } from '~/utils/crypto'
import { signToken } from '~/utils/jwt'
import databaseService from '~/services/database.service'
import { IUser } from '~/models/schemas/User.schema'

/**
 * Register a new user
 * @description Register a new user using the native MongoDB driver
 * @path /users/register
 * @method POST
 * @body {name: string, username: string, email?: string, password: string, confirm_password: string, date_of_birth: ISOString, role: UserRole, phone_number: string}
 * @response {access_token: string, refresh_token: string}
 */
export const registerController = async (
  req: Request<ParamsDictionary, any, RegisterRequestBody>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name, username, email, password, confirm_password, date_of_birth, role, phone_number } = req.body

    // Basic check: Ensure passwords match
    if (password !== confirm_password) {
      return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
        message: USER_MESSAGES.PASSWORD_NOT_MATCH
      })
    }

    // Hash the user's password before insertion
    const hashedPassword = hashPassword(password)

    // Build the user document (you can add or modify fields as needed)
    const now = new Date()
    const userDocument = {
      name,
      username,
      email: email || '', // Email có thể là empty string nếu không được cung cấp
      phone_number,
      date_of_birth: new Date(date_of_birth),
      password: hashedPassword,
      role,
      created_at: now,
      updated_at: now,
      email_verify_token: '',
      forgot_password_token: '',
      verify: 0, // Assuming 0 corresponds to "Unverified"
      bio: '',
      location: '',
      website: '',
      cover_photo: '',
      avatar: ''
    }

    // Insert the new user into the database using the native MongoDB driver
    const insertResult = await databaseService.users.insertOne(userDocument)

    // Create a payload for the JWT tokens; adjust the payload properties as needed
    const payload = {
      user_id: insertResult.insertedId.toString(),
      role
      // You can add additional fields if needed (e.g., name, email)
    }

    // Generate JWT tokens (access and refresh tokens)
    const accessTokenOptions = { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN } // e.g., 15 minutes for the access token
    const refreshTokenOptions = { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN } // e.g., 7 days for the refresh token
    const accessToken: any = await signToken({ payload, options: accessTokenOptions })
    const refreshToken: any = await signToken({ payload, options: refreshTokenOptions })

    return res.status(HTTP_STATUS_CODE.CREATED).json({
      message: USER_MESSAGES.REGISTER_SUCCESS,
      result: {
        access_token: accessToken,
        refresh_token: refreshToken
      }
    })
  } catch (error) {
    // next khi truyền error vào thì mặc định express sẽ hiểu đó là error handler
    next(error)
  }
}

/**
 * Login user
 * @description Login user
 * @path /users/login
 * @method POST
 * @body {username: string, password: string}
 * @author QuangDoo
 * @response {access_token: string, refresh_token: string}
 */
export const loginController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as IUser
    const user_id = user._id?.toString() || ''

    const result = await usersServices.login(user_id)

    return res.status(HTTP_STATUS_CODE.CREATED).json({
      message: USER_MESSAGES.LOGIN_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Logout user
 * @description Logout user
 * @path /users/logout
 * @method POST
 * @header {Authorization: Bearer <access_token>}
 * @body {refresh_token: string}
 * @author QuangDoo
 * @response {message: string}
 */
export const logoutController = async (
  req: import('express').Request,
  res: import('express').Response,
  next: import('express').NextFunction
) => {
  try {
    // Nếu bạn lưu refresh_token trong DB, hãy xóa nó ở đây
    // const { refresh_token } = req.body
    // await databaseService.refreshTokens.deleteOne({ token: refresh_token })

    return res.json({
      message: USER_MESSAGES.LOGOUT_SUCCESS
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Get user by id
 * @description Get user
 * @path /users/get-user
 * @method GET
 * @header {Authorization: Bearer <access_token>}
 * @author QuangDoo
 */
export const getUserController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user_id = req?.decoded_authorization?.user_id

    const result = await usersServices.getUserById(user_id || '')

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: USER_MESSAGES.GET_USER_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}

export const getAllUsersController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await usersServices.getAllUsers()

    return res.status(200).json({
      result
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Get users with pagination, search and filter
 * @description Get users with pagination, search and filter
 * @path /users
 * @method GET
 * @query {page?: number, limit?: number, search?: string, role?: UserRole, sort_by?: string, sort_order?: 'asc' | 'desc'}
 * @author QuangDoo
 */
export const getUsersController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = req.query as GetUsersQuery
    const result = await usersServices.getUsers(query)

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: USER_MESSAGES.GET_USERS_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Get user by ID
 * @description Get user by ID
 * @path /users/:id
 * @method GET
 * @param {id: string}
 * @author QuangDoo
 */
export const getUserByIdController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const result = await usersServices.getUserById(id)

    if (!result) {
      return res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
        message: USER_MESSAGES.USER_NOT_FOUND
      })
    }

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: USER_MESSAGES.GET_USER_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Update user
 * @description Update user
 * @path /users/:id
 * @method PUT
 * @param {id: string}
 * @body {name?: string, email?: string, phone_number?: string, date_of_birth?: Date, bio?: string, location?: string, avatar?: string, role?: UserRole}
 * @author QuangDoo
 */
export const updateUserController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const updateData = req.body as UpdateUserRequestBody

    const result = await usersServices.updateUser(id, updateData)

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: USER_MESSAGES.UPDATE_USER_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Delete user
 * @description Delete user
 * @path /users/:id
 * @method DELETE
 * @param {id: string}
 * @author QuangDoo
 */
export const deleteUserController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const result = await usersServices.deleteUser(id)

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: 'User deleted successfully',
      result
    })
  } catch (error) {
    next(error)
  }
}
