import { ObjectId } from 'mongodb'

export interface SongHistory {
  _id?: ObjectId
  roomId: string // Mã phòng
  videoId: string // ID video YouTube
  title: string // Tên bài hát
  thumbnail: string // URL ảnh thumbnail
  channelTitle: string // Tên kênh YouTube
  playedAt: Date // Thời gian bài hát được phát
}

export class SongHistory {
  _id?: ObjectId
  roomId: string
  videoId: string
  title: string
  thumbnail: string
  channelTitle: string
  playedAt: Date

  constructor(songHistory: SongHistory) {
    this._id = songHistory._id
    this.roomId = songHistory.roomId
    this.videoId = songHistory.videoId
    this.title = songHistory.title
    this.thumbnail = songHistory.thumbnail
    this.channelTitle = songHistory.channelTitle
    this.playedAt = songHistory.playedAt
  }
}
