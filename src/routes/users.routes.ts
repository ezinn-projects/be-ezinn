import { Router } from 'express'
import {
  deleteUserController,
  forgotPasswordController,
  getAllUsersController,
  getUserByIdController,
  getUserController,
  getUsersController,
  loginController,
  logoutController,
  registerController,
  resetPasswordController,
  updateUserController
} from '~/controllers/users.controller'
import {
  accessTokenValidator,
  checkLoginUserExists,
  checkRegisterUserExists,
  checkUserId,
  forgotPasswordValidator,
  loginValidator,
  registerValidator,
  resetPasswordValidator,
  updateUserValidator
} from '~/middlewares/users.middleware'
import { wrapRequestHandler } from '~/utils/handlers'

const usersRouter = Router()

/**
 * @description Register a new user
 * @path /users/register
 * @method POST
 * @body {name: string, username: string, email?: string, password: string, confirm_password: string, date_of_birth: ISOString, role: UserRole, phone_number: string}
 * @author QuangDoo
 */
usersRouter.post('/register', checkRegisterUserExists, registerValidator, wrapRequestHandler(registerController))

/**
 * @description Login user
 * @path /users/login
 * @method POST
 * @body {username: string, password: string}
 * @author QuangDoo
 */
usersRouter.post('/login', checkLoginUserExists, loginValidator, loginController)

/**
 * @description Logout user
 * @path /users/logout
 * @method Post
 * @header {Authorization: Bearer <access_token>}
 * @body {refresh_token: string}
 * @author QuangDoo
 */
usersRouter.post('/logout', accessTokenValidator, wrapRequestHandler(logoutController))

/**
 * @description Forgot password
 * @path /users/forgot-password
 * @method POST
 * @body {email: string}
 * @author QuangDoo
 */
usersRouter.post('/forgot-password', forgotPasswordValidator, wrapRequestHandler(forgotPasswordController))

/**
 * @description Reset password
 * @path /users/reset-password
 * @method POST
 * @body {forgot_password_token: string, password: string, confirm_password: string}
 * @author QuangDoo
 */
usersRouter.post('/reset-password', resetPasswordValidator, wrapRequestHandler(resetPasswordController))

/**
 * @description Get all users (legacy)
 */
usersRouter.get('/get-all-users', wrapRequestHandler(getAllUsersController))

/**
 * @description Get user by id (current user)
 */
usersRouter.get('/get-user', accessTokenValidator, checkUserId, wrapRequestHandler(getUserController))

/**
 * @description Get users with pagination, search and filter
 * @path /users
 * @method GET
 * @query {page?: number, limit?: number, search?: string, role?: UserRole, sort_by?: string, sort_order?: 'asc' | 'desc'}
 * @author QuangDoo
 */
usersRouter.get('/', wrapRequestHandler(getUsersController))

/**
 * @description Get user by ID
 * @path /users/:id
 * @method GET
 * @param {id: string}
 * @author QuangDoo
 */
usersRouter.get('/:id', wrapRequestHandler(getUserByIdController))

/**
 * @description Update user
 * @path /users/:id
 * @method PUT
 * @param {id: string}
 * @body {name?: string, email?: string, phone_number?: string, date_of_birth?: Date, bio?: string, location?: string, avatar?: string, role?: UserRole}
 * @author QuangDoo
 */
usersRouter.put('/:id', updateUserValidator, wrapRequestHandler(updateUserController))

/**
 * @description Delete user
 * @path /users/:id
 * @method DELETE
 * @param {id: string}
 * @author QuangDoo
 */
usersRouter.delete('/:id', wrapRequestHandler(deleteUserController))

export default usersRouter
