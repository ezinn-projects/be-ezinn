import { ObjectId } from 'mongodb'

export interface SongHistory {
  _id?: ObjectId
  roomId: string // Mã phòng
  video_id: string // ID video YouTube
  title: string // Tên bài hát
  thumbnail: string // URL ảnh thumbnail
  author: string // Tên kênh YouTube
  playedAt: Date // Thời gian bài hát được phát
}

export class SongHistory {
  _id?: ObjectId
  roomId: string
  video_id: string
  title: string
  thumbnail: string
  author: string
  playedAt: Date

  constructor(songHistory: SongHistory) {
    this._id = songHistory._id
    this.roomId = songHistory.roomId
    this.video_id = songHistory.video_id
    this.title = songHistory.title
    this.thumbnail = songHistory.thumbnail
    this.author = songHistory.author
    this.playedAt = songHistory.playedAt
  }
}
