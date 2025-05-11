import { Request, Response, NextFunction } from 'express'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import inventoryService from '~/services/inventory.service'

export const updateStock = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { itemId } = req.params
    const { quantity, operation } = req.body

    if (!['add', 'subtract'].includes(operation)) {
      return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
        message: 'Invalid operation. Must be either "add" or "subtract"'
      })
    }

    const result = await inventoryService.updateStock(itemId, quantity, operation)
    if (!result) {
      return res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
        message: 'Item not found'
      })
    }

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: 'Stock updated successfully',
      result
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Insufficient stock') {
      return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
        message: 'Insufficient stock'
      })
    }
    next(error)
  }
}

export const getLowStockItems = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await inventoryService.checkLowStock()
    return res.status(HTTP_STATUS_CODE.OK).json({
      message: 'Low stock items retrieved successfully',
      result: items
    })
  } catch (error) {
    next(error)
  }
}

export const getStockHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { itemId } = req.params
    const { startDate, endDate } = req.query

    if (!startDate || !endDate) {
      return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
        message: 'Start date and end date are required'
      })
    }

    const history = await inventoryService.getStockHistory(
      itemId,
      new Date(startDate as string),
      new Date(endDate as string)
    )

    return res.status(HTTP_STATUS_CODE.OK).json({
      message: 'Stock history retrieved successfully',
      result: history
    })
  } catch (error) {
    next(error)
  }
}
