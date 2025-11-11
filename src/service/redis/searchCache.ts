import { Redis } from "ioredis";
import { REDIS_DB_PASS } from "../../config.js";

export default class SearchCache {
  private conn: Redis;
  private prefix: string;

  constructor(prefix: string) {
    this.conn = new Redis({ db: 1, password: REDIS_DB_PASS });
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
