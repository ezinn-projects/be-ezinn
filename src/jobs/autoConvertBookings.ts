import { bookingService } from '~/services/booking.service'
import databaseService from '~/services/database.service'
import { ObjectId } from 'mongodb'
import redis from '~/services/redis.service'

// Set để theo dõi các booking đang được xử lý
const processingBookings = new Set<string>()

/**
 * Auto Convert Bookings Job
 * This job automatically converts all pending bookings to room schedules
 */
export const autoConvertPendingBookings = async () => {
  console.log('Running auto-convert pending bookings job...')

  try {
    // Find all pending bookings
    const pendingBookings = await databaseService.bookings.find({ status: 'pending' }).toArray()

    if (pendingBookings.length === 0) {
      console.log('No pending bookings to convert')
      return {
        success: true,
        message: 'No pending bookings to convert',
        converted: 0
      }
    }

    console.log(
      `Found ${pendingBookings.length} pending booking(s) to convert: ${pendingBookings.map((b) => b._id).join(', ')}`
    )
    let successCount = 0
    let failCount = 0
    let skippedCount = 0
    const results = []

    // Process each booking
    for (const booking of pendingBookings) {
      const bookingId = booking._id.toString()

      // Kiểm tra nếu booking đang được xử lý ở process khác
      const lockKey = `booking_lock:${bookingId}`
      const isLocked = processingBookings.has(bookingId)

      // Thử khóa ở Redis cũng để tránh trường hợp nhiều server xử lý cùng lúc
      let redisLocked = false
      try {
        redisLocked = (await redis.set(lockKey, 'locked', 'EX', 60, 'NX')) === null
      } catch (redisError) {
        console.error(`Redis error when checking lock for booking ${bookingId}:`, redisError)
        // Vẫn tiếp tục nếu Redis lỗi, chỉ dựa vào local lock
      }

      // Nếu đang bị khóa, bỏ qua booking này
      if (isLocked || redisLocked) {
        console.log(`Booking ${bookingId} is currently being processed by another task, skipping...`)
        skippedCount++
        results.push({
          booking_id: bookingId,
          success: false,
          skipped: true,
          error: 'Booking is being processed by another task'
        })
        continue
      }

      // Đánh dấu booking đang được xử lý
      processingBookings.add(bookingId)

      try {
        console.log(`Processing booking ${bookingId}...`)

        // Convert booking to have string _id to match IClientBooking type
        const bookingWithStringId = {
          ...booking,
          _id: bookingId
        }

        // Convert booking to room schedules
        const scheduleIds = await bookingService.convertClientBookingToRoomSchedule(bookingWithStringId)
        console.log(
          `Successfully converted booking ${bookingId} to ${scheduleIds.length} room schedule(s): ${scheduleIds.join(', ')}`
        )

        // Verify the room schedules were created
        const scheduleCount = await databaseService.roomSchedule.countDocuments({
          _id: { $in: scheduleIds.map((id) => new ObjectId(id)) }
        })

        console.log(`Verified ${scheduleCount} out of ${scheduleIds.length} room schedules exist in the database`)

        results.push({
          booking_id: bookingId,
          success: true,
          schedule_ids: scheduleIds,
          verified_count: scheduleCount
        })

        successCount++
      } catch (error) {
        console.error(`Error converting booking ${bookingId}:`, error)
        if (error instanceof Error) {
          console.error('Error details:', error.message)
          console.error('Error stack:', error.stack)
        }

        results.push({
          booking_id: bookingId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })

        failCount++
      } finally {
        // Bỏ đánh dấu booking đang xử lý
        processingBookings.delete(bookingId)

        // Giải phóng khóa trong Redis nếu có
        try {
          await redis.del(lockKey)
        } catch (redisError) {
          console.error(`Redis error when releasing lock for booking ${bookingId}:`, redisError)
        }
      }
    }

    const summary = {
      success: true,
      message: `Auto-converted ${successCount} booking(s). Failed: ${failCount}. Skipped: ${skippedCount}`,
      converted: successCount,
      failed: failCount,
      skipped: skippedCount,
      results
    }

    console.log('Auto-convert job completed:', summary.message)
    return summary
  } catch (error) {
    console.error('Error in auto-convert job:', error)
    return {
      success: false,
      message: `Error in auto-convert job: ${error instanceof Error ? error.message : 'Unknown error'}`,
      converted: 0,
      skipped: 0
    }
  }
}
