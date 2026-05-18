import { Redis } from "ioredis";

import { REDIS_DB_PASS, REDIS_URL } from "../../config.js";

export const REDIS_LOGICAL_DB = {
  STATE: 0,
  SEARCH_CACHE: 1,
} as const;

export function stripRedisUrlDb(redisUrl: string): string {
  try {
    const parsed = new URL(redisUrl);
    if (parsed.protocol !== "redis:" && parsed.protocol !== "rediss:") {
      return redisUrl;
    }

    parsed.pathname = "";
    parsed.searchParams.delete("db");
    return parsed.toString();
  } catch {
    return redisUrl;
  }
}

export function createRedis(logicalDb: number): Redis {
  const options = {
    db: logicalDb,
    ...(REDIS_DB_PASS ? { password: REDIS_DB_PASS } : {}),
  };

  if (REDIS_URL) {
    return new Redis(stripRedisUrlDb(REDIS_URL), options);
  }

  return new Redis(options);
}
