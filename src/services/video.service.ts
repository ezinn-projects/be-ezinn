import youtubeDl from 'youtube-dl-exec'

export const getAudioUrl = async (videoId: string): Promise<string> => {
  try {
    console.time('AudioFetch') // Bắt đầu đo thời gian

    // Sử dụng yt-dlp để lấy URL stream trực tiếp
    const audioUrl = await youtubeDl(`https://www.youtube.com/watch?v=${videoId}`, {
      format: 'bestaudio[ext=m4a]/bestaudio', // Chỉ lấy stream audio tốt nhất
      getUrl: true, // Lấy URL trực tiếp
      skipDownload: true, // Không tải file xuống
      quiet: true, // Tắt log không cần thiết
      noWarnings: true, // Bỏ qua cảnh báo
      noCheckCertificates: true // Bỏ qua kiểm tra SSL
    })

    console.timeEnd('AudioFetch') // Kết thúc đo thời gian

    if (!audioUrl || typeof audioUrl !== 'string') {
      throw new Error('Audio URL not found')
    }

    console.log('Audio URL:', audioUrl)
    return audioUrl
  } catch (error) {
    console.error(`Failed to fetch or process audio for ID: ${videoId}`, error)
    throw new Error('Could not retrieve audio URL')
  }
}
