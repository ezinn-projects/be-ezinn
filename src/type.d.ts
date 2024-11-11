import { Request } from 'express'
import { User } from './models/schemas/User.schema'
import { JwtPayload } from './models/schemas/JWT.schema'

declare module 'express' {
  interface Request {
    user?: User
    roomTypeIds?: ObjectId[]
    roomTypeId?: ObjectId
    decoded_authorization?: JwtPayload
  }
}
