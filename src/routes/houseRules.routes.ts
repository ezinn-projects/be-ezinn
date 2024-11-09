import { Router } from 'express'
import { addHouseRuleController } from '~/controllers/houseRules.controllers'
import { addHouseRuleValidator } from '~/middlewares/houseRules.middleware'
import { wrapRequestHanlder } from '~/utils/handlers'

const houseRulesRouter = Router()

/**
 * @description Add house rule
 * @path /house-rules/add-house-rule
 * @method POST
 * @body {name: string, description: string}
 * @author QuangDoo
 */
houseRulesRouter.post('/add-house-rule', addHouseRuleValidator, wrapRequestHanlder(addHouseRuleController))

export default houseRulesRouter
