import { v2 as cloudinary } from 'cloudinary'
import { NextFunction, Request, Response } from 'express'
import multer from 'multer'

const storage = multer.memoryStorage()
const upload = multer({ storage })

export const uploadFileController = [
  upload.single('file'), // Chỉ nhận một file mỗi lần
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file provided' })
      }

      const folder = req.body.folder || req.query.folder || 'default' // Lấy folder từ body hoặc query
      const allowedFolders = ['rooms', 'feedback', 'profile_images'] // Danh sách thư mục được phép

      // Kiểm tra folder có hợp lệ không
      if (!allowedFolders.includes(folder)) {
        return res.status(400).json({ message: 'Invalid folder name' })
      }

      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream({ folder }, (error, result) => {
          if (error) return reject(error)
          resolve(result)
        })

        uploadStream.end(req.file!.buffer) // Gửi buffer file vào Cloudinary
      })

      const { secure_url: fileURL, public_id: publicId } = result as any

      res.status(200).json({
        message: 'File uploaded successfully',
        fileURL,
        publicId
      })
    } catch (error) {
      next(error)
    }
  }
]
