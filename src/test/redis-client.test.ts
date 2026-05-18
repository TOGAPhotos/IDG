import { describe, expect, it } from "vitest";

import { stripRedisUrlDb } from "../service/redis/client.js";

describe("Redis client URL normalization", () => {
  it("strips path database indexes so logical DB options win", () => {
    expect(stripRedisUrlDb("redis://localhost:6379/0")).toBe("redis://localhost:6379");
    expect(stripRedisUrlDb("rediss://:secret@example.com:6380/12")).toBe(
      "rediss://:secret@example.com:6380",
    );
  });

  it("preserves non-DB URL components", () => {
    expect(stripRedisUrlDb("redis://user:pass@example.com:6379/1?family=6&name=cache")).toBe(
      "redis://user:pass@example.com:6379?family=6&name=cache",
    );
  });

  it("strips db query parameters", () => {
    expect(stripRedisUrlDb("redis://localhost:6379/0?db=7&name=cache")).toBe(
      "redis://localhost:6379?name=cache",
    );
  });

  it("leaves invalid URLs untouched", () => {
    expect(stripRedisUrlDb("localhost:6379/0")).toBe("localhost:6379/0");
  });
});
