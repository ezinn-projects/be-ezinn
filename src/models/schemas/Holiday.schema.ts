import { ObjectId } from 'mongodb'

export interface IHoliday {
  _id?: ObjectId
  date: Date
  name: string
  description?: string
  createdAt: Date
  updatedAt?: Date
}

export class Holiday {
  _id?: ObjectId
  date: Date
  name: string
  description?: string
  createdAt: Date
  updatedAt?: Date

  constructor(holiday: IHoliday) {
    this._id = holiday._id
    this.date = holiday.date
    this.name = holiday.name
    this.description = holiday.description
    this.createdAt = holiday.createdAt
    this.updatedAt = holiday.updatedAt
  }
}
