import youtubeDl from 'youtube-dl-exec'

export const getVideoUrl = async (videoId: string): Promise<string> => {
  try {
    const videoInfo = await youtubeDl(`https://www.youtube.com/watch?v=${videoId}`, {
      dumpSingleJson: true,
      format: 'best[ext=mp4][height<=1080]'
    })

    if (typeof videoInfo === 'object' && 'url' in videoInfo) {
      return (videoInfo as any).url
    }

    throw new Error('No URL found in video information')
  } catch (error) {
    console.error(`Failed to fetch video URL for video ID: ${videoId}`, error)
    throw new Error('Could not retrieve video URL')
  }
}
