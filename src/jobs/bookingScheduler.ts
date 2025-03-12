// src/schedulers/bookingScheduler.ts

import { roomScheduleService } from '~/services/roomSchedule.service'

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
