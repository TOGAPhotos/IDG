import { Redis } from "ioredis";
import { REDIS_DB_PASS } from "../../config.js";

export default class SearchCache {
  private conn: Redis;
  constructor(dbId: number) {
    this.conn = new Redis({ db: dbId, password: REDIS_DB_PASS });
  }

  async set(keyword: string, value: any, expire: number = 60 * 5) {
    const key = `${keyword}`;
    this.conn.set(key, JSON.stringify(value));
    this.conn.expire(key, expire);
  }

  async get(keyword: string) {
    const key = `${keyword}`;
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
