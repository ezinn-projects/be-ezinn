import { checkSchema } from 'express-validator'
import { validate } from '~/utils/validation'

export const addSongValidator = validate(
  checkSchema({
    videoId: {
      notEmpty: {
        errorMessage: 'Video ID is required'
      }
    }
  })
)
