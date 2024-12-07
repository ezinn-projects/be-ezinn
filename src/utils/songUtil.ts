import redis from '~/services/redis.service'

export const playNextSong = async (roomId: string) => {
  const queueKey = `room_${roomId}_queue`
  const nowPlayingKey = `room_${roomId}_now_playing`

  // Lấy bài hát đầu tiên trong hàng đợi
  const nextSong = await redis.lpop(queueKey)

  if (nextSong) {
    const song = JSON.parse(nextSong)
    await redis.set(nowPlayingKey, JSON.stringify(song)) // Đặt bài hát đang phát
    console.log(`Now playing in room ${roomId}:`, song)
    return song
  }

  console.log(`No songs to play in room ${roomId}`)
  return null
}
