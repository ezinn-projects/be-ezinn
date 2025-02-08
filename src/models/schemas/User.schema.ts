import { ObjectId } from 'mongodb'
import { UserRole, UserVerifyStatus } from '~/constants/enum'

export interface IUser {
  _id: ObjectId
  name: string
  email?: string
  phone_number: string
  date_of_birth: Date
  password: string // Hashed
  pin_code?: string // Hashed PIN for tablet access
  email_verify_token?: string
  forgot_password_token?: string
  verify?: UserVerifyStatus
  sso_provider?: string
  sso_id?: string
  created_at: Date
  updated_at?: Date
  // Additional profile fields
  bio?: string
  location?: string
  avatar?: string
  role: UserRole // e.g., User, Admin, Employee
}

// Tại sao lại dùng class thay vì dùng interface để đại diện schema
// khi dùng interface thì chỉ đại diện cho kiểu dữ liệu thôi
// đối với class thì đại diện cho kiểu dữ liệu và object luôn

// Khai báo như thế này, code sẽ tự hiểu là public
export class User {
  // khai báo thuộc tính của class User
  _id?: ObjectId
  email: string
  name: string
  date_of_birth: Date
  password: string
  created_at: Date
  updated_at: Date
  email_verify_token: string
  forgot_password_token: string
  verify: UserVerifyStatus

  bio: string
  location: string
  avatar: string

  role: UserRole

  // khai báo contructor với thuộc tính trên
  constructor(user: IUser) {
    const date = new Date()

    this._id = user._id
    this.email = user.email || ''
    this.name = user.name || ''
    this.date_of_birth = user.date_of_birth || date
    this.password = user.password
    this.created_at = user.created_at || date
    this.updated_at = user.updated_at || date

    this.email_verify_token = user.email_verify_token || ''
    this.forgot_password_token = user.forgot_password_token || ''
    this.verify = user.verify || UserVerifyStatus.Unverified

    this.bio = user.bio || ''
    this.location = user.location || ''
    this.avatar = user.avatar || ''

    this.role = user.role || UserRole.User
  }
}
