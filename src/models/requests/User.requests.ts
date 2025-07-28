import { UserRole } from '~/constants/enum'

export interface RegisterRequestBody {
  name: string
  username: string
  email?: string // Email trở thành optional
  password: string
  confirm_password: string
  date_of_birth: Date
  role: UserRole
  phone_number: string
}

export interface LoginRequestBody {
  username: string // Có thể là email hoặc phone_number
  password: string
}

export interface ForgotPasswordRequestBody {
  email: string
}

export interface ResetPasswordRequestBody {
  forgot_password_token: string
  password: string
  confirm_password: string
}

export interface UpdateUserRequestBody {
  name?: string
  email?: string
  phone_number?: string
  date_of_birth?: Date
  bio?: string
  location?: string
  avatar?: string
  role?: UserRole
}

export interface GetUsersQuery {
  page?: string
  limit?: string
  search?: string
  role?: UserRole
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}
