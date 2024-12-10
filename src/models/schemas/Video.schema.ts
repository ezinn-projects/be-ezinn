interface Video {
  video_id: string
  title: string
  duration: number
  url: string
  thumbnail: string
  author: string
}

export class VideoSchema implements Video {
  video_id: string
  title: string
  duration: number
  url: string
  thumbnail: string
  author: string

  constructor(video: Video) {
    this.video_id = video.video_id
    this.title = video.title
    this.duration = video.duration
    this.url = video.url
    this.thumbnail = video.thumbnail
    this.author = video.author
  }
}
