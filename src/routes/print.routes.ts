import { Router } from 'express'
import { printController, testPrintController } from '~/controllers/print.controller'
import { wrapRequestHandler } from '~/utils/handlers'

const printRouter = Router()

/**
 * @description Test print endpoint
 * @path /print/test
 * @method POST
 * @author QuangDoo
 */
printRouter.post('/test', wrapRequestHandler(testPrintController))

// new “real” print endpoint
/**
 * @description Enqueue a print job
 * @path     /print      (POST)
 */
printRouter.post('/', wrapRequestHandler(printController))

export default printRouter
