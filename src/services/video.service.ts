import youtubeDl from 'youtube-dl-exec'
import ffmpeg from 'fluent-ffmpeg'

export const getVideoUrl = async (videoId: string): Promise<{ videoUrl: string; audioUrl: string }> => {
  try {
    // Lấy URL gộp cả video và audio với chất lượng 720p
    const videoUrl = await youtubeDl(`https://www.youtube.com/watch?v=${videoId}`, {
      format: 'best[height=720][ext=mp4]/best[height=720]/bestvideo[ext=mp4]', // fallback chuỗi
      getUrl: true,
      skipDownload: true
    })

    if (!videoUrl) {
      throw new Error('Combined video and audio URL not found')
    }

    console.log('Combined Video URL:', videoUrl)
    return { videoUrl: videoUrl as string, audioUrl: '' } // Trả về URL gộp
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
