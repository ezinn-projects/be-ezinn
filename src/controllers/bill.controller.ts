import { Request, Response } from 'express'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import billService from '~/services/bill.service'

export const getBill = async (req: Request, res: Response) => {
  const { scheduleId } = req.params
  const { actualEndTime } = req.query

  const bill = await billService.getBill(scheduleId, actualEndTime as string)
  return res.status(HTTP_STATUS_CODE.OK).json({
    message: 'Get bill successfully',
    result: bill
  })
}

export const printBill = async (req: Request, res: Response) => {
  const { scheduleId } = req.params
  const { actualEndTime, paymentMethod } = req.body

  const billData = await billService.getBill(scheduleId, actualEndTime as string, paymentMethod)

  const bill = await billService.printBill(billData)

  return res.status(HTTP_STATUS_CODE.OK).json({
    message: 'Print bill successfully',
    result: bill
  })
}
