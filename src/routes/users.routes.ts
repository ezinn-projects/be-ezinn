import { Router } from 'express'
import {
  getAllUsersController,
  getUserController,
  loginController,
  registerController
} from '~/controllers/users.controller'
import {
  accessTokenValidator,
  checkLoginUserExists,
  checkRegisterUserExists,
  checkUserId,
  loginValidator,
  registerValidator
} from '~/middlewares/users.middleware'
import { wrapRequestHandler } from '~/utils/handlers'

const usersRouter = Router()

/**
 * @description Register a new user
 * @path /users/register
 * @method POST
 * @body {name: string, email: string, password: string, confirm_password: string, date_of_birth: ISOString}
 * @author QuangDoo
 */
usersRouter.post('/register', checkRegisterUserExists, registerValidator, wrapRequestHandler(registerController))

/**
 * @description Login user
 * @path /users/login
 * @method POST
 * @body {email: string, password: string}
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

// usersRouter.post('/logout', accessTokenValidator, wrapRequestHandler(logoutController))

/**
 * @description Get all users
 */
usersRouter.get('/get-all-users', wrapRequestHandler(getAllUsersController))

/**
 * @description Get user by id
 */
usersRouter.get('/get-user', accessTokenValidator, checkUserId, wrapRequestHandler(getUserController))

export default usersRouter
