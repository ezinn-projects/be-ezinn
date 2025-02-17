import { UserRole } from '~/constants/enum'

export interface RegisterRequestBody {
  name: string
  email: string
  password: string
  confirm_password: string
  date_of_birth: Date
  role: UserRole
  phone_number: string
}
