export const CLOUDINARY_UPLOAD_CONFIG = {
  resource_type: 'auto',
  quality: 'auto',
  fetch_format: 'auto',
  timeout: 60000,
  transformation: [{ width: 'auto', crop: 'scale' }]
} as const
