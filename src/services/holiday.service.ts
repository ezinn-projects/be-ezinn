import { ObjectId } from 'mongodb'
import { IHoliday } from '~/models/schemas/Holiday.schema'
import databaseService from './database.service'
import { ErrorWithStatus } from '~/models/Error'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

class HolidayService {
  async addHoliday(holiday: Omit<IHoliday, '_id' | 'createdAt' | 'updatedAt'>): Promise<IHoliday> {
    const newHoliday: IHoliday = {
      ...holiday,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const result = await databaseService.holidays.insertOne(newHoliday)
    return { ...newHoliday, _id: result.insertedId }
  }

  async getHolidays(): Promise<IHoliday[]> {
    return await databaseService.holidays.find().toArray()
  }

  async getHolidayByDate(date: Date): Promise<IHoliday | null> {
    const startOfDay = dayjs(date).startOf('day').toDate()
    const endOfDay = dayjs(date).endOf('day').toDate()

    return await databaseService.holidays.findOne({
      date: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    })
  }

  async updateHoliday(id: string, holiday: Partial<IHoliday>): Promise<IHoliday | null> {
    const objectId = new ObjectId(id)
    const updateData = {
      ...holiday,
      updatedAt: new Date()
    }

    const result = await databaseService.holidays.findOneAndUpdate(
      { _id: objectId },
      { $set: updateData },
      { returnDocument: 'after' }
    )

    return result
  }

  async deleteHoliday(id: string): Promise<boolean> {
    const objectId = new ObjectId(id)
    const result = await databaseService.holidays.deleteOne({ _id: objectId })
    return result.deletedCount > 0
  }

  async isHoliday(date: Date): Promise<boolean> {
    const holiday = await this.getHolidayByDate(date)
    return holiday !== null
  }
}

export const holidayService = new HolidayService()
