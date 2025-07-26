import { Redis } from "ioredis";
import { REDIS_DB } from "./distribute.js";
import { REDIS_DB_PASS } from "../../config.js";

export class UploadQueueCache {
  private conn: Redis;
  constructor() {
    this.conn = new Redis({
      db: REDIS_DB.UPLOAD_QUEUE_STATUS,
      password: REDIS_DB_PASS,
    });
  }

  private genKey(queueId: number) {
    return `queue_${queueId}`;
  }

  async get(queueId: number) {
    return this.conn.get(this.genKey(queueId));
  }

  async set(queueId: number, screenerId: number) {
    const key = this.genKey(queueId);
    this.conn.set(key, screenerId);
    this.conn.expire(key, 60 * 5);
  }

  async update(queueId: number, screenerId: number): Promise<boolean> {
    const key = this.genKey(queueId);
    const cacheInfo = await this.conn.get(key);
    if (cacheInfo === null || Number(cacheInfo) === screenerId) {
      this.conn.set(key, screenerId);
      this.conn.expire(key, 60 * 5);
      return true;
    } else {
      return false;
    }
  }

  async del(queueId: number) {
    this.conn.del(this.genKey(queueId));
  }
}
