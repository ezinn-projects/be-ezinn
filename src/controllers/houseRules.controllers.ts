import { NextFunction, Request, Response } from 'express'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import { HOUSE_RULES_MESSAGES } from '~/constants/messages'
import { AddHouseRuleRequestBody } from '~/models/requests/HouseRule.request'
import { houseRuleServices } from '~/services/houseRules.services'
import { type ParamsDictionary } from 'express-serve-static-core'

export const addHouseRuleController = async (
  req: Request<ParamsDictionary, any, AddHouseRuleRequestBody>,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await houseRuleServices.addHouseRule(req.body)

    return res.status(HTTP_STATUS_CODE.CREATED).json({
      message: HOUSE_RULES_MESSAGES.ADD_HOUSE_RULES_SUCCESS,
      result
    })
  } catch (error) {
    next(error)
  }
}
