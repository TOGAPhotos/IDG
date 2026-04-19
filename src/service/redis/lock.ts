import { Redis } from "ioredis";
import Redlock, { ExecutionError, ResourceLockedError, type RedlockAbortSignal } from "redlock";

import { REDIS_DB_PASS } from "../../config.js";

const redis = new Redis({ db: 0, password: REDIS_DB_PASS });

const redlock = new Redlock([redis], {
  retryCount: 3,
  retryDelay: 200,
  retryJitter: 100,
  driftFactor: 0.01,
  automaticExtensionThreshold: 500,
});

export class LockAcquireError extends Error {
  constructor(keys: string[]) {
    super(`获取锁失败: ${keys.join(",")}`);
    this.name = "LockAcquireError";
  }
}

export interface LockOptions {
  ttl?: number;
  retryCount?: number;
  retryDelay?: number;
  retryJitter?: number;
}

const DEFAULT_TTL = 10_000;

function toRedlockSettings(opts: LockOptions) {
  const { ttl: _ttl, ...settings } = opts;
  return settings;
}

function wrap(err: unknown, keys: string[]): never {
  if (err instanceof ResourceLockedError || err instanceof ExecutionError) {
    throw new LockAcquireError(keys);
  }
  throw err;
}

export async function withLock<T>(
  keys: string[],
  fn: (signal: RedlockAbortSignal) => Promise<T>,
  opts: LockOptions = {},
): Promise<T> {
  const ttl = opts.ttl ?? DEFAULT_TTL;
  try {
    return await redlock.using(keys, ttl, toRedlockSettings(opts), fn);
  } catch (err) {
    wrap(err, keys);
  }
}

export async function acquireLock(keys: string[], opts: LockOptions = {}) {
  const ttl = opts.ttl ?? DEFAULT_TTL;
  try {
    return await redlock.acquire(keys, ttl, toRedlockSettings(opts));
  } catch (err) {
    wrap(err, keys);
  }
}
