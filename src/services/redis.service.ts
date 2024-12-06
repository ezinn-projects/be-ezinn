import Redis from 'ioredis'

const redis = new Redis({
  host: process.env.VPS_IP,
  port: Number(process.env.REDIS_PORT),
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times) => Math.min(times * 50, 2000) // Retry mỗi 50ms đến tối đa 2s
})

redis.on('connect', () => {
  console.log('Connected to Redis')
})

redis.on('error', (err) => {
  console.error('Redis connection error:', err)
})

export default redis
