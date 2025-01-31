import { Router } from 'express'
import { uploadFileController } from '~/controllers/file.controller'

const fileRouter = Router()

// API endpoint upload file
fileRouter.post('/upload', uploadFileController)

export default fileRouter
