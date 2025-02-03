import cloudinary from '~/cloudinary.config'
import { CLOUDINARY_UPLOAD_CONFIG } from '~/constants/config'

// Hàm upload ảnh lên Cloudinary
export const uploadImageToCloudinary = async (fileBuffer: Buffer, folder: string) => {
  try {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          ...CLOUDINARY_UPLOAD_CONFIG
        },
        (error, result) => {
          if (error) {
            reject(error)
            return
          }
          resolve({
            url: result?.secure_url,
            publicId: result?.public_id
          })
        }
      )
      uploadStream.end(fileBuffer)
    })
  } catch (error) {
    console.error('Cloudinary upload error:', error)
    throw new Error(`Upload to Cloudinary failed: ${(error as Error).message}`)
  }
}

// Hàm xóa ảnh từ Cloudinary
export const deleteImageFromCloudinary = async (publicId: string) => {
  try {
    await cloudinary.uploader.destroy(publicId)
    return { message: 'Image deleted successfully' }
  } catch (error) {
    throw new Error('Delete from Cloudinary failed: ' + (error as Error).message)
  }
}
