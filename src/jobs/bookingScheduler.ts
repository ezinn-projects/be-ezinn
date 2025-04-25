// src/schedulers/bookingScheduler.ts

import { roomScheduleService } from '~/services/roomSchedule.service'
import cron from 'node-cron'
import databaseService from '~/services/database.service'

export function startBookingScheduler() {
  setInterval(async () => {
    try {
      await roomScheduleService.autoCancelLateBookings()
      console.log('Checked and cancelled late bookings if any.')
    } catch (error) {
      console.error('Error in auto-cancelling late bookings:', error)
    }
  }, 60 * 1000) // chạy mỗi 60 giây
}

export async function finishSchedulerInADay() {
  try {
    // Thiết lập cron job chạy mỗi ngày lúc 23:59
    cron.schedule('59 23 * * *', async () => {
      console.log('Running auto-finish job at 23:59...')
      await roomScheduleService.autoFinishAllScheduleInADay()
    })

    console.log('Checked and finished late bookings if any.')
  } catch (error) {
    console.error('Error in auto-finishing late bookings:', error)
  }
}

// Kiểm tra và chuyển đổi các bookings có trạng thái "pending" mỗi 5 phút
export function startBookingConverter() {
  // Kiểm tra và chuyển đổi ngay khi khởi động
  setTimeout(checkAndConvertPendingBookings, 10 * 1000)

  // Sau đó chạy định kỳ mỗi 5 phút
  setInterval(checkAndConvertPendingBookings, 5 * 60 * 1000)

  console.log('Booking converter started')
}

// Hàm kiểm tra và chuyển đổi các booking có status là "pending"
async function checkAndConvertPendingBookings() {
  try {
    console.log('Checking for pending bookings to convert...')

    // Tìm tất cả booking có status là "pending"
    const pendingBookings = await databaseService.bookings.find({ status: 'pending' }).toArray()

    if (pendingBookings.length === 0) {
      console.log('No pending bookings to convert')
      return
    }

    console.log(`Found ${pendingBookings.length} pending bookings. Converting...`)

    // Chuyển đổi từng booking
    for (const booking of pendingBookings) {
      try {
        const scheduleIds = await roomScheduleService.createSchedulesFromBooking(booking._id.toString())
        console.log(`Successfully converted booking ${booking._id} to ${scheduleIds.length} room schedules`)
      } catch (error) {
        console.error(`Failed to convert booking ${booking._id}:`, error)
      }
    }

    console.log('Finished converting pending bookings')
  } catch (error) {
    console.error('Error checking and converting pending bookings:', error)
  }
}
