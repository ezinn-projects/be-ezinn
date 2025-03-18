import { FNBOrder } from '~/models/schemas/FNB.schema'

export interface ICreateFNBOrderRequestBody {
  roomScheduleId: string
  order: FNBOrder
  createdBy?: string
}

export interface IUpdateFNBOrderRequestBody {
  order: Partial<FNBOrder>
  updatedBy?: string
}
