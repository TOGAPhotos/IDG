import type { Redis } from "ioredis";

import { createRedis, REDIS_LOGICAL_DB } from "./client.js";

export default class SearchCache {
  private conn: Redis;
  private prefix: string;

  constructor(prefix: string) {
    this.conn = createRedis(REDIS_LOGICAL_DB.SEARCH_CACHE);
    this.prefix = prefix;
  }

  async set(keyword: string, value: any, expire: number = 60 * 5) {
    const key = `${this.prefix}:${keyword}`;
    this.conn.set(key, JSON.stringify(value));
    this.conn.expire(key, expire);
  }

  async get(keyword: string) {
    const key = `${this.prefix}:${keyword}`;
    const result = await this.conn.get(key);
    if (result === null) {
      return null;
    }
    return JSON.parse(result);
  }

  async flush() {
    this.conn.flushdb();
  }
}
