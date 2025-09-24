import { Request, Response, NextFunction } from 'express'

/**
 * Middleware để tự động parse các trường JSON string từ FormData
 * Điều này giải quyết vấn đề khi frontend gửi object phức tạp qua multipart/form-data
 * mà bị serialize thành JSON string
 */
export const parseJsonFields = (fields: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Chỉ xử lý khi có body và là multipart/form-data
      if (req.body && Object.keys(req.body).length > 0) {
        fields.forEach((field) => {
          if (req.body[field] && typeof req.body[field] === 'string') {
            try {
              // Thử parse JSON string
              const parsed = JSON.parse(req.body[field])
              req.body[field] = parsed
              console.log(`✅ Đã parse thành công field "${field}" từ JSON string`)
            } catch (error) {
              // Nếu không parse được, giữ nguyên giá trị gốc
              console.log(`⚠️ Không thể parse field "${field}" thành JSON, giữ nguyên giá trị gốc`)
            }
          }
        })
      }
      next()
    } catch (error) {
      console.error('Lỗi trong parseJsonFields middleware:', error)
      next(error)
    }
  }
}

/**
 * Middleware đặc biệt cho FNB Menu để parse variants và inventory
 */
export const parseFnbMenuJsonFields = parseJsonFields(['variants', 'inventory'])
