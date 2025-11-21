import "dotenv/config";
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
const redisStore = new Map<string, string>();
vi.mock("ioredis", () => {
  class Redis {
    constructor() {}
    async get(key: string) {
      return redisStore.has(key) ? redisStore.get(key)! : null;
    }
    set(key: string, value: any) {
      redisStore.set(key, value?.toString?.() ?? String(value));
    }
    expire() {}
    del(key: string) {
      redisStore.delete(key);
    }
    flushdb() {
      redisStore.clear();
    }
    flushall() {
      redisStore.clear();
    }
    disconnect() {}
    quit() {}
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
