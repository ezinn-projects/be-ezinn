// src/schedulers/bookingScheduler.ts

import { roomScheduleService } from '~/services/roomSchedule.service'
import cron from 'node-cron'

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
