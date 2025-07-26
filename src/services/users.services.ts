import { TokenType } from '~/constants/enum'
import { USER_MESSAGES } from '~/constants/messages'
import { RegisterRequestBody, UpdateUserRequestBody, GetUsersQuery } from '~/models/requests/User.requests'
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
          username: payload.username,
          email: payload.email || '',
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

  async getUsers(query: GetUsersQuery) {
    const page = parseInt(query.page || '1')
    const limit = parseInt(query.limit || '10')
    const skip = (page - 1) * limit

    // Build filter
    const filter: any = {}

    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { username: { $regex: query.search, $options: 'i' } },
        { email: { $regex: query.search, $options: 'i' } },
        { phone_number: { $regex: query.search, $options: 'i' } }
      ]
    }

    if (query.role) {
      filter.role = query.role
    }

    // Build sort
    const sort: any = {}
    if (query.sort_by) {
      sort[query.sort_by] = query.sort_order === 'desc' ? -1 : 1
    } else {
      sort.created_at = -1 // Default sort by created_at desc
    }

    // Get total count
    const total = await databaseService.users.countDocuments(filter)

    // Get users with pagination
    const users = await databaseService.users
      .find(filter, {
        projection: {
          password: 0,
          email_verify_token: 0,
          forgot_password_token: 0,
          verify: 0
        }
      })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray()

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit)
      }
    }
  }

  async updateUser(userId: string, payload: UpdateUserRequestBody) {
    // Check if user exists
    const existingUser = await databaseService.users.findOne({ _id: new ObjectId(userId) })
    if (!existingUser) {
      throw new Error(USER_MESSAGES.USER_NOT_FOUND)
    }

    // Check for duplicate email if email is being updated
    if (payload.email && payload.email !== existingUser.email) {
      const emailExists = await databaseService.users.findOne({
        email: payload.email,
        _id: { $ne: new ObjectId(userId) }
      })
      if (emailExists) {
        throw new Error(USER_MESSAGES.EMAIL_ALREADY_EXISTS)
      }
    }

    // Check for duplicate phone if phone is being updated
    if (payload.phone_number && payload.phone_number !== existingUser.phone_number) {
      const phoneExists = await databaseService.users.findOne({
        phone_number: payload.phone_number,
        _id: { $ne: new ObjectId(userId) }
      })
      if (phoneExists) {
        throw new Error(USER_MESSAGES.PHONE_ALREADY_EXISTS)
      }
    }

    // Prepare update data
    const updateData: any = {
      ...payload,
      updated_at: new Date()
    }

    // Convert date_of_birth to Date if provided
    if (payload.date_of_birth) {
      updateData.date_of_birth = new Date(payload.date_of_birth)
    }

    const result = await databaseService.users.updateOne({ _id: new ObjectId(userId) }, { $set: updateData })

    if (result.matchedCount === 0) {
      throw new Error(USER_MESSAGES.USER_NOT_FOUND)
    }

    // Return updated user
    return await this.getUserById(userId)
  }

  async deleteUser(userId: string) {
    const result = await databaseService.users.deleteOne({ _id: new ObjectId(userId) })

    if (result.deletedCount === 0) {
      throw new Error(USER_MESSAGES.USER_NOT_FOUND)
    }

    return { message: 'User deleted successfully' }
  }
}

export const usersServices = new UsersServices()
