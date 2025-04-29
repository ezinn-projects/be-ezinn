import { CronJob } from 'cron'
import { autoConvertPendingBookings } from './autoConvertBookings'

// Run every 3 minutes instead of 10 seconds
const autoConvertJob = new CronJob('*/3 * * * *', async () => {
  try {
    const result = await autoConvertPendingBookings()
    console.log('Auto convert job result:', result)
  } catch (error) {
    console.error('Error running auto convert job:', error)
  }
})

export const startScheduledJobs = () => {
  console.log('Starting scheduled jobs...')

  // Start auto convert job
  autoConvertJob.start()
  console.log('Auto convert bookings job scheduled (runs every 3 minutes)')

  // Add more scheduled jobs here if needed
}

export const stopScheduledJobs = () => {
  console.log('Stopping scheduled jobs...')

  // Stop auto convert job
  autoConvertJob.stop()

  // Stop more scheduled jobs here if needed
}
