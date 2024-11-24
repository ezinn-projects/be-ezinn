import { RoomStatus, RoomType } from '~/constants/enum'
import { Equipment, PricePerTime } from '../schemas/Room.schema'
import { ObjectId } from 'mongodb'

// Interface cho RoomRequest (input API)
export interface IAddRoomRequestBody {
  _id: ObjectId // ID duy nhất của phòng (do database tự động tạo)
  roomName: string // Tên phòng hiển thị
  roomType: RoomType // Loại phòng ('Small', 'Medium', 'Large')
  maxCapacity: number // Số lượng khách tối đa
  status: RoomStatus // Trạng thái phòng ('Available', 'Occupied', 'Cleaning')
  pricePerTime: PricePerTime // Thông tin giá phòng
  equipment: Equipment // Thông tin thiết bị
  description?: string // Mô tả phòng (không bắt buộc)
  images?: string[] // Danh sách URL ảnh minh họa (không bắt buộc)
  createdAt: string // Ngày tạo phòng
  updatedAt?: string // Ngày cập nhật cuối cùng
}
