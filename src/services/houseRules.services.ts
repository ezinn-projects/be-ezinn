// import { connectToDatabase } from "../db/mongoClient";
// import { HouseRule } from "../interfaces/HouseRule";
import { AddHouseRuleRequestBody } from '~/models/requests/HouseRule.request'
import { HouseRule } from '~/models/schemas/HouseRules.schema'
import databaseService from './database.services'

class HouseRulesServices {
  async addHouseRule(payload: AddHouseRuleRequestBody) {
    const result = await databaseService.houseRules.insertOne(new HouseRule(payload))

    return result.insertedId.toString()
  }
}
// Tạo quy định mới
export const houseRuleServices = new HouseRulesServices()
