import multer from 'multer'

const storage = multer.memoryStorage() // Sử dụng bộ nhớ tạm
export const uploadMiddleware = multer({ storage }).array('files', 5) // Tối đa 5 file
