import redis from './redis.service'

export class CacheService {
  async get(key: string): Promise<string | null> {
    return redis.get(key)
  }

  async set(key: string, value: string): Promise<void> {
    await redis.set(key, value)
  }

  async setex(key: string, seconds: number, value: string): Promise<void> {
    await redis.setex(key, seconds, value)
  }

  async del(key: string): Promise<void> {
    await redis.del(key)
  }

  async exists(key: string): Promise<boolean> {
    return (await redis.exists(key)) === 1
  }

  async expire(key: string, seconds: number): Promise<void> {
    await redis.expire(key, seconds)
  }

  async ttl(key: string): Promise<number> {
    return redis.ttl(key)
  }
}
