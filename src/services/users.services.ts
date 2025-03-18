import { TokenType } from '~/constants/enum'
import { USER_MESSAGES } from '~/constants/messages'
import { RegisterRequestBody } from '~/models/requests/User.requests'
import { User } from '~/models/schemas/User.schema'
import { hashPassword } from '~/utils/crypto'
import { signToken } from '~/utils/jwt'
import databaseService from './database.service'
import { ObjectId } from 'mongodb'

class UsersServices {
  private signAccessToken(userId: string) {
    return signToken({
      payload: { user_id: userId.toString(), token_type: TokenType.AccessToken },
      options: { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN, algorithm: 'HS256' }
    })
  }

  private signRefreshToken(userId: string) {
    return signToken({
      payload: { user_id: userId.toString(), token_type: TokenType.RefreshToken },
      options: { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN, algorithm: 'HS256' }
    })
  }

  private signAccessTAndRefreshToken(userId: string) {
    return Promise.all([this.signAccessToken(userId), this.signRefreshToken(userId)])
  }

  async register(payload: RegisterRequestBody) {
    try {
      const result = await databaseService.users.insertOne(
        new User({
          ...payload,
          _id: new ObjectId(),
          date_of_birth: new Date(payload.date_of_birth),
          password: hashPassword(payload.password),
          phone_number: payload.phone_number,
          created_at: new Date(),
          updated_at: new Date()
        })
      )

      const user_id = result.insertedId.toString()

      const [access_token, refresh_token] = await this.signAccessTAndRefreshToken(user_id)

      return {
        access_token,
        refresh_token
      }
    } catch (error) {
      throw error
    }
  }

  async checkEmailExists(email: string) {
    const result = await databaseService.users.findOne({ email })

    return !!result
  }

  async login(userId: string) {
    if (!userId) {
      throw new Error(USER_MESSAGES.USER_NOT_EXISTS)
    }

    const [access_token, refresh_token] = await this.signAccessTAndRefreshToken(userId)

    return { access_token, refresh_token }
  }

  async getUserById(userId: string) {
    const result = await databaseService.users.findOne(
      { _id: new ObjectId(userId) },
      {
        projection: {
          password: 0,
          email_verify_token: 0,
          forgot_password_token: 0,
          verify: 0
        }
      }
    )

    return result
  }

  async getAllUsers() {
    const result = await databaseService.users.find({}).toArray()

    return result
  }
}

export const usersServices = new UsersServices()
