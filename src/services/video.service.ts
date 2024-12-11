import youtubeDl from 'youtube-dl-exec'
import ffmpeg from 'fluent-ffmpeg'

export const getVideoUrl = async (videoId: string): Promise<{ videoUrl: string; audioUrl: string }> => {
  try {
    // Lấy URL video tốt nhất (1080p trở lên) và audio tốt nhất
    const [videoUrl, audioUrl] = await Promise.all([
      youtubeDl(`https://www.youtube.com/watch?v=${videoId}`, {
        format: 'bestvideo[ext=mp4]',
        getUrl: true,
        skipDownload: true
      }),
      youtubeDl(`https://www.youtube.com/watch?v=${videoId}`, {
        format: 'bestaudio[ext=m4a]',
        getUrl: true,
        skipDownload: true
      })
    ])

    if (!videoUrl || !audioUrl) {
      throw new Error('Video or audio URL not found')
    }
    // Merge video và audio
    const mergedUrl = videoUrl

    console.log('audioUrl :>> ', audioUrl)

    return { videoUrl, audioUrl } as { videoUrl: string; audioUrl: string }
  } catch (error) {
    console.error(`Failed to fetch or process video for ID: ${videoId}`, error)
    throw new Error('Could not retrieve video URL')
  }
}

// Hàm merge video và audio
const mergeVideoAndAudio = async (videoUrl: string, audioUrl: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const outputPath = `merged-${Date.now()}.mp4` // Tạo file tạm
    ffmpeg()
      .input(videoUrl) // Input video URL
      .input(audioUrl) // Input audio URL
      .outputOptions('-c:v copy') // Không mã hóa lại video
      .outputOptions('-c:a aac') // Mã hóa audio thành AAC
      .outputOptions('-f mp4') // Định dạng MP4
      .save(outputPath) // Lưu file tạm
      .on('end', () => {
        console.log('Merge completed:', outputPath)
        resolve(outputPath) // Trả về đường dẫn file merge
      })
      .on('error', (err) => {
        console.error('FFmpeg merge error:', err)
        reject(err)
      })
  })
}
