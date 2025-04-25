import { bookingService } from '~/services/booking.service'
import databaseService from '~/services/database.service'
import { ObjectId } from 'mongodb'

/**
 * Hàm xử lý tự động chuyển đổi các booking từ client sang room schedules
 * Chỉ chuyển đổi các booking có trạng thái "pending"
 */
async function processClientBookings() {
  try {
    console.log('Looking for pending bookings to convert to room schedules...')

    // Tìm tất cả booking có trạng thái "pending"
    const pendingBookings = await databaseService.bookings.find({ status: 'pending' }).toArray()

    if (pendingBookings.length === 0) {
      console.log('No pending bookings found.')
      return
    }

    console.log(`Found ${pendingBookings.length} pending bookings. Processing...`)

    for (const booking of pendingBookings) {
      try {
        // Thử chuyển đổi booking thành các room schedules
        // Convert the booking object to IClientBooking format by removing MongoDB-specific _id
        const bookingForConversion = {
          ...booking,
          _id: booking._id instanceof ObjectId ? booking._id.toString() : booking._id
        }
        const scheduleIds = await bookingService.convertClientBookingToRoomSchedule(bookingForConversion)
        console.log(`Successfully converted booking ${booking._id} to ${scheduleIds.length} room schedules.`)
      } catch (error) {
        console.error(`Failed to convert booking ${booking._id}:`, error)
      }
    }

    console.log('Finished processing pending bookings.')
  } catch (error) {
    console.error('Error in booking converter job:', error)
  }
}

/**
 * Khởi chạy job định kỳ kiểm tra và chuyển đổi các booking
 */
export function startBookingConverterJob() {
  // Chạy một lần ngay khi server khởi động (sau 1 phút)
  setTimeout(processClientBookings, 60 * 1000)

  // Sau đó chạy định kỳ mỗi 5 phút
  setInterval(processClientBookings, 5 * 60 * 1000)

  console.log('Booking converter job started. Will check for pending bookings every 5 minutes.')
}
