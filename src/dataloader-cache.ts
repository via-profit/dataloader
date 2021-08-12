import { RedisCache as Interface, RedisCacheProps } from '@via-profit/dataloader';

import { TIMEOUT_MIN_INT, TIMEOUT_MAX_INT } from './constants';
import ms from './time-parser';

type CacheNode<T> = {
  expireAt: string | number;
  payload: T;
};

/**
 * DataLoader Redis cache
 */
class RedisCache<T> implements Interface<T> {
  #props: RedisCacheProps | null = null;

  public constructor(props: RedisCacheProps) {
    this.#props = props;
    const { defaultExpiration } = this.#props;
    const expires = ms(defaultExpiration);

    const interval = Math.min(Math.max(expires, TIMEOUT_MIN_INT), TIMEOUT_MAX_INT);

    setInterval(() => {
      this.removeExpires();
    }, interval);

    this.removeExpires();
  }

  private async removeExpires(): Promise<void> {
    const { redis, cacheName } = this.#props;
    const allData = await redis.hgetall(cacheName);
    const expiredKeys: string[] = [];

    Object.entries(allData).forEach(async ([hash, payloadStr]) => {
      try {
        const { expireAt } = JSON.parse(payloadStr) as CacheNode<T>;

        if (new Date().getTime() > expireAt) {
          expiredKeys.push(hash);
        }
      } catch (err) {
        expiredKeys.push(hash);
      }
    });

    if (expiredKeys.length) {
      await redis.hdel(cacheName, ...expiredKeys);
    }
  }

  public async get(key: string) {
    const { redis, cacheName } = this.#props;
    const data = await redis.hget(cacheName, key);

    if (data === null) {
      return null;
    }

    try {
      const { expireAt, payload } = JSON.parse(data) as CacheNode<T>;

      // if node are expire, then delete it anr return as null
      if (new Date().getTime() > expireAt) {
        redis.hdel(cacheName, key);

        return null;
      }

      return payload;
    } catch (err) {
      redis.hdel(cacheName, key);

      return null;
    }
  }

  public async set(key: string, payload: T, expire?: string | number): Promise<void> {
    if (typeof payload === 'undefined') {
      throw new TypeError(
        'Payload data must must be a string, null, object, number or boolean type, ' +
          `but got ${typeof payload}`,
      );
    }

    const { redis, defaultExpiration, cacheName } = this.#props;
    const expireAt = new Date().getTime() + ms(expire ?? defaultExpiration);
    const data: CacheNode<T> = {
      expireAt,
      payload,
    };

    await redis.hset(cacheName, key, JSON.stringify(data));
  }

  public async delele(key: string | ReadonlyArray<string>): Promise<void> {
    const { redis, cacheName } = this.#props;
    const keys = Array.isArray(key) ? key : [key];
    await redis.hdel(cacheName, ...keys);
  }

  public async clear(): Promise<void> {
    const { redis, cacheName } = this.#props;
    await redis.del(cacheName);
  }
}

export default RedisCache;
