export interface AddSongRequestBody {
  videoId: string
  title: string
  thumbnail: string
  channelTitle: string
  url?: string
  position?: 'top' | 'end'
  duration?: number
}
