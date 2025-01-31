import cloudinary from '~/cloudinary.config'

// Hàm upload ảnh lên Cloudinary
export const uploadImageToCloudinary = async (fileBuffer: Buffer, folder: string) => {
  try {
    const result = await cloudinary.uploader.upload_stream({
      folder,
      resource_type: 'auto',
      quality: 'auto',
      fetch_format: 'auto',
      timeout: 60000,
      transformation: [{ width: 'auto', crop: 'scale' }]
    })
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'auto',
          quality: 'auto',
          fetch_format: 'auto',
          timeout: 60000,
          transformation: [{ width: 'auto', crop: 'scale' }]
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
