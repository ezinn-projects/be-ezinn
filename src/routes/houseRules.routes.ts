import { Router } from 'express'
import { addHouseRuleValidator } from '~/middlewares/houseRules.middleware'
import { wrapRequestHandler } from '~/utils/handlers'

const houseRulesRouter = Router()

/**
 * @description Add house rule
 * @path /house-rules/add-house-rule
 * @method POST
 * @body {name: string, description: string}
 * @author QuangDoo
 */
houseRulesRouter.post('/add-house-rule', addHouseRuleValidator, wrapRequestHandler(addHouseRuleController))

export default houseRulesRouter
