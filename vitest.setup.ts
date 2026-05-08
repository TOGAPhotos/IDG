import dotenv from "dotenv";
dotenv.config({ path: ".env.development" });
import { vi } from "vitest";

// align env with test intent
process.env.RUNNING_ENV = process.env.RUNNING_ENV || "DEV";
process.env.NODE_ENV = process.env.NODE_ENV || "test";

// mimic production boot behavior for BigInt serialization
// so Prisma results with BigInt can be JSON stringified in responses
// eslint-disable-next-line no-extend-native
BigInt.prototype.toJSON = function () {
  return this.toString();
};

// lightweight in-memory mock for ioredis to avoid external dependency during tests
type RedisValue = {
  value: string;
  expiresAt?: number;
};

const redisStore = new Map<string, RedisValue>();

function normalizeRedisValue(value: any): string {
  return value?.toString?.() ?? String(value);
}

function expireIfNeeded(key: string) {
  const item = redisStore.get(key);
  if (item?.expiresAt !== undefined && item.expiresAt <= Date.now()) {
    redisStore.delete(key);
  }
}

function getRedisValue(key: string): string | null {
  expireIfNeeded(key);
  return redisStore.get(key)?.value ?? null;
}

function setRedisValue(key: string, value: any, expiresInSeconds?: number) {
  redisStore.set(key, {
    value: normalizeRedisValue(value),
    expiresAt: expiresInSeconds === undefined ? undefined : Date.now() + expiresInSeconds * 1000,
  });
}

function patternToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped.replace(/\*/g, ".*").replace(/\?/g, ".")}$`);
}

function normalizeRelatedIdentifiers(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean);
  }
  if (value && typeof value === "object") {
    return Object.values(value).map(String).filter(Boolean);
  }
  return [];
}

function getLimits(params: Record<string, any>, riskLevel: number) {
  if (riskLevel > Number(params.highRiskThreshold)) {
    return {
      total: Number(params.highRiskTotal),
      sensitive: Number(params.highRiskSensitive),
    };
  }
  if (riskLevel >= Number(params.mediumRiskThreshold)) {
    return {
      total: Number(params.mediumRiskTotal),
      sensitive: Number(params.mediumRiskSensitive),
    };
  }
  return {
    total: Number(params.lowRiskTotal),
    sensitive: Number(params.lowRiskSensitive),
  };
}

function applyWafRecordUpdate(key: string, params: Record<string, any>): string {
  const raw = getRedisValue(key);
  let record: Record<string, any> = {};
  if (raw) {
    try {
      record = JSON.parse(raw);
    } catch {
      record = {};
    }
  }

  const now = Number(params.now);
  let riskLevel = Number(record.riskLevel ?? 0);
  let lastActive = Number(record.lastActive ?? now);
  let windowStart = Number(record.windowStart ?? now);
  let count = Number(record.count ?? 0);
  let sensitiveCount = Number(record.sensitiveCount ?? 0);

  if (riskLevel > 0 && now - lastActive > Number(params.riskDecayTimeMs)) {
    riskLevel = Math.max(0, riskLevel - Number(params.riskDecayAmount));
  }

  if (now - windowStart > Number(params.windowSizeMs)) {
    count = 0;
    sensitiveCount = 0;
    windowStart = now;
  }

  riskLevel += Number(params.addRisk ?? 0);

  if (params.incrementCount) {
    count += 1;
  }
  if (params.incrementSensitive) {
    sensitiveCount += 1;
  }

  const relatedIdentifiers = new Set<string>(normalizeRelatedIdentifiers(record.relatedIdentifiers));
  for (const identifier of normalizeRelatedIdentifiers(params.relatedIdentifiers)) {
    relatedIdentifiers.add(identifier);
  }

  if (params.applyRateLimitPenalty) {
    const limits = getLimits(params, riskLevel);
    const totalExceeded = params.checkTotalLimit && count > limits.total;
    const sensitiveExceeded = params.checkSensitiveLimit && sensitiveCount > limits.sensitive;
    if (totalExceeded) {
      riskLevel += Number(params.rateLimitExceededScore);
    }
    if (sensitiveExceeded) {
      riskLevel += Number(params.sensitiveRateLimitExceededScore);
    }
    record.totalLimitExceeded = totalExceeded;
    record.sensitiveLimitExceeded = sensitiveExceeded;
  } else {
    record.totalLimitExceeded = false;
    record.sensitiveLimitExceeded = false;
  }

  const updated = JSON.stringify({
    id: params.id,
    riskLevel,
    lastActive: now,
    windowStart,
    count,
    sensitiveCount,
    totalLimitExceeded: record.totalLimitExceeded,
    sensitiveLimitExceeded: record.sensitiveLimitExceeded,
    relatedIdentifiers: Array.from(relatedIdentifiers),
  });

  setRedisValue(key, updated, Number(params.ttlSeconds));
  return updated;
}

vi.mock("ioredis", () => {
  class Redis {
    constructor() {}
    async get(key: string) {
      return getRedisValue(key);
    }
    async set(key: string, value: any, ...args: any[]) {
      const exIndex = args.findIndex((arg) => String(arg).toUpperCase() === "EX");
      const expiresInSeconds = exIndex >= 0 ? Number(args[exIndex + 1]) : undefined;
      setRedisValue(key, value, expiresInSeconds);
      return "OK";
    }
    async setex(key: string, seconds: number, value: any) {
      setRedisValue(key, value, seconds);
      return "OK";
    }
    async expire(key: string, seconds: number) {
      const value = getRedisValue(key);
      if (value === null) {
        return 0;
      }
      setRedisValue(key, value, seconds);
      return 1;
    }
    async exists(...keys: string[]) {
      return keys.reduce((count, key) => count + (getRedisValue(key) === null ? 0 : 1), 0);
    }
    async del(...keys: string[]) {
      let removed = 0;
      for (const key of keys) {
        expireIfNeeded(key);
        if (redisStore.delete(key)) {
          removed += 1;
        }
      }
      return removed;
    }
    async keys(pattern: string) {
      const matcher = patternToRegExp(pattern);
      for (const key of Array.from(redisStore.keys())) {
        expireIfNeeded(key);
      }
      return Array.from(redisStore.keys()).filter((key) => matcher.test(key));
    }
    async eval(_script: string, keyCount: number, ...args: any[]) {
      const keys = args.slice(0, keyCount).map(String);
      const argv = args.slice(keyCount);
      if (keys.length === 1 && argv.length === 1) {
        return applyWafRecordUpdate(keys[0], JSON.parse(String(argv[0])));
      }
      throw new Error("Unsupported Redis eval call in test mock");
    }
    async flushdb() {
      redisStore.clear();
      return "OK";
    }
    async flushall() {
      redisStore.clear();
      return "OK";
    }
    disconnect() {}
    async quit() {}
  }
  return { Redis };
});

// mock MQ producer/consumer to suppress AMQP connection attempts
vi.mock("@/service/messageQueue/producer.js", () => {
  return {
    default: class {
      constructor() {}
      async send() {
        return;
      }
    },
  };
});

vi.mock("@/service/messageQueue/consume.js", () => {
  return {
    default: class {
      constructor() {}
      async consume() {
        return;
      }
    },
  };
});

// mock image processor module to drop side-effects (MQ consumers / COS traffic)
vi.mock("@/service/imageProcesser/index.js", () => {
  class PhotoCopyrightOverlayConfig {
    constructor(params: Record<string, unknown>) {
      Object.assign(this, params);
    }
  }
  return {
    PhotoCopyrightOverlayConfig,
    ImageProcess: {
      copyrightOverlay: async () => {
        return;
      },
    },
  };
});
