import { ObjectId } from 'mongodb'
import { RoomType } from '~/constants/enum'
import { VirtualRoom } from '~/models/schemas/VirtualRoom.schema'
import databaseService from '../services/database.service'

async function createVirtualRooms() {
  try {
    console.log('🚀 Bắt đầu tạo Virtual Rooms...')

    // 0. Kiểm tra xem đã có virtual rooms chưa
    const existingVirtualRooms = await databaseService.virtualRooms.find().toArray()
    if (existingVirtualRooms.length > 0) {
      console.log(`⚠️  Đã có ${existingVirtualRooms.length} virtual rooms trong database`)
      console.log('💡 Nếu muốn tạo lại, hãy xóa virtual rooms cũ trước')
      console.log('📋 Danh sách virtual rooms hiện tại:')
      existingVirtualRooms.forEach((vr, index) => {
        console.log(`  ${index + 1}. ${vr.virtualRoomName} - Size: ${vr.virtualSize}`)
      })
      return
    }

    // 1. Lấy danh sách physical rooms
    const physicalRooms = await databaseService.rooms.find().sort({ roomId: 1 }).toArray()
    console.log(`📋 Tìm thấy ${physicalRooms.length} physical rooms`)

    // 2. Tạo virtual rooms với hardcode theo thứ tự phòng
    const virtualRooms: VirtualRoom[] = []

    physicalRooms.forEach((physicalRoom, index) => {
      const roomNumber = index + 1
      let virtualSize: RoomType
      let priority: number

      // Hardcode: Phòng 1-3 = Small, Phòng 4-6 = Medium, Phòng 7+ = Large
      if (roomNumber <= 3) {
        virtualSize = RoomType.Small
        priority = roomNumber
      } else if (roomNumber <= 6) {
        virtualSize = RoomType.Medium
        priority = roomNumber - 3
      } else {
        virtualSize = RoomType.Large
        priority = roomNumber - 6
      }

      virtualRooms.push(
        new VirtualRoom({
          _id: new ObjectId(),
          virtualRoomId: roomNumber,
          virtualRoomName: `Room ${virtualSize}${priority}`,
          virtualSize,
          physicalRoomId: physicalRoom._id,
          priority,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        })
      )
    })

    // 3. Lưu vào database
    await databaseService.virtualRooms.insertMany(virtualRooms)
    console.log(`✅ Đã tạo ${virtualRooms.length} virtual rooms`)

    // 4. Hiển thị kết quả
    console.log('\n📊 Danh sách Virtual Rooms:')
    virtualRooms.forEach((vr) => {
      console.log(
        `  Phòng ${vr.virtualRoomId}: ${vr.virtualRoomName} (${vr.virtualSize}) -> Physical Room ${vr.physicalRoomId}`
      )
    })

    console.log('\n🎯 Phân loại theo thứ tự phòng:')
    console.log(`  Phòng 1-3: ${virtualRooms.filter((vr) => vr.virtualSize === RoomType.Small).length} phòng Small`)
    console.log(`  Phòng 4-6: ${virtualRooms.filter((vr) => vr.virtualSize === RoomType.Medium).length} phòng Medium`)
    console.log(`  Phòng 7+: ${virtualRooms.filter((vr) => vr.virtualSize === RoomType.Large).length} phòng Large`)
  } catch (error) {
    console.error('❌ Lỗi khi tạo Virtual Rooms:', error)
    throw error
  }
}

// Chạy migration
if (require.main === module) {
  createVirtualRooms()
    .then(() => {
      console.log('🎉 Migration hoàn thành!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('💥 Migration thất bại:', error)
      process.exit(1)
    })
}

export { createVirtualRooms }
