export interface AddSongRequestBody {
  video_id: string
  title: string
  thumbnail: string
  author: string
  url?: string
  position?: 'top' | 'end'
  duration?: number
}
