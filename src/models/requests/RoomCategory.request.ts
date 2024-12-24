import { ObjectId } from 'mongodb'

export interface IRoomCategoryRequest {
  name: string // Tên loại phòng (Phòng nhỏ, vừa, lớn)
  capacity: number // Số người tối đa
  pricePerHour: number // Giá cơ bản mỗi giờ
  equipment: {
    tv: boolean
    soundSystem: string
    microphone: number
  }
  description?: string // Mô tả loại phòng
}
