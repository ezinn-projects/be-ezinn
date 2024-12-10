import { checkSchema } from 'express-validator'
import { validate } from '~/utils/validation'

export const addSongValidator = validate(
  checkSchema({
    video_id: {
      notEmpty: {
        errorMessage: 'Video ID is required'
      }
    },
    duration: {
      notEmpty: {
        errorMessage: 'Duration is required'
      },
      isInt: {
        options: { min: 0 },
        errorMessage: 'Duration must be a positive integer'
      }
    },
    position: {
      optional: true,
      isIn: {
        options: [['top', 'end']]
      }
    }
  })
)
