import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express, { Express, NextFunction, Request, Response } from "express";
import { WAF_MODE } from "../config.js";
import { WAF, SensitiveAPIWAF, setWafMode } from "../components/waf/index.js";
import { redis, RateLimitRecord } from "../components/waf/store.js";
import { WAF_CONFIG } from "../components/waf/config.js";
import { success, fail } from "../exntend/response.js";

const browserHeaders = {
    "User-Agent": "Mozilla/5.0",
    Accept: "application/json",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    Referer: "https://example.com/",
    "Content-Type": "application/json",
    "Sec-Fetch-Site": "same-origin",
};

function withHeaders(req: request.Test, headers: Record<string, string> = {}) {
    const merged = { ...browserHeaders, ...headers };
    for (const [key, value] of Object.entries(merged)) {
        req.set(key, value);
    }
    return req;
}

function parseRecord(data: string | null) {
    expect(data).not.toBeNull();
    return JSON.parse(data!);
}

function createApp() {
    const app = express();
    app.response.success = success;
    app.response.fail = fail;

    app.use((req: Request, _res: Response, next: NextFunction) => {
        req.userIp = (req.headers["x-test-ip"] as string) || "127.0.0.1";
        req.tId = (req.headers["x-tid"] as string) || "test-trace-id";
        req.ua = req.headers["user-agent"] || "";
        next();
    });

    app.use(WAF);
    app.get("/api/normal", (_req: Request, res: Response) => {
        res.status(200).json({ message: "ok" });
    });
    app.get("/api/sensitive", SensitiveAPIWAF, (_req: Request, res: Response) => {
        res.status(200).json({ message: "ok" });
    });

    return app;
}

describe("WAF", () => {
    let app: Express;

    beforeEach(async () => {
        setWafMode(WAF_MODE.BLOCK);
        await redis.flushdb();
        app = createApp();
    });

    afterEach(() => {
        setWafMode(WAF_MODE.MONITOR);
    });

    it("allows normal requests under the low-risk limit", async () => {
        const res = await withHeaders(request(app).get("/api/normal"));

        expect(res.status).toBe(200);
    });

    it("does not escalate a missing trace ID into an immediate block", async () => {
        const res = await withHeaders(request(app).get("/api/normal"), {
            "X-Tid": "NO_TRACE_ID",
        });

        const ipRecord = parseRecord(await redis.get("waf:record:127.0.0.1"));
        expect(res.status).toBe(200);
        expect(ipRecord.riskLevel).toBe(WAF_CONFIG.NO_TRACE_ID_SCORE);
        expect(ipRecord.riskLevel).toBeLessThan(WAF_CONFIG.LIMITS.MEDIUM_RISK.threshold);
        expect(await redis.get("waf:block:127.0.0.1")).toBeNull();
    });

    it("attributes rule risk to the IP record when a trace ID is present", async () => {
        await withHeaders(request(app).get("/api/normal"), {
            "User-Agent": "curl/7.64.1",
            "X-Tid": "trace-a-span-1",
        });

        const ipRecord = parseRecord(await redis.get("waf:record:127.0.0.1"));
        const tidRecord = parseRecord(await redis.get("waf:record:trace"));

        expect(ipRecord.riskLevel).toBeGreaterThanOrEqual(WAF_CONFIG.UA_SCORE);
        expect(ipRecord.relatedIdentifiers).toContain("trace");
        expect(tidRecord.riskLevel).toBe(0);
        expect(tidRecord.relatedIdentifiers).toContain("127.0.0.1");
    });

    it("accumulates IP risk when the same IP rotates trace IDs", async () => {
        const statuses: number[] = [];
        const attempts = Math.ceil(WAF_CONFIG.RISK_LIMIT_BLOCK / WAF_CONFIG.UA_SCORE) + 1;

        for (let i = 0; i < attempts; i += 1) {
            const res = await withHeaders(request(app).get("/api/normal"), {
                "User-Agent": "curl/7.64.1",
                "X-Tid": `rotating${i}-span`,
            });
            statuses.push(res.status);
        }

        const ipRecord = parseRecord(await redis.get("waf:record:127.0.0.1"));
        expect(statuses).toContain(429);
        expect(ipRecord.riskLevel).toBeGreaterThanOrEqual(WAF_CONFIG.RISK_LIMIT_BLOCK);
        expect(await redis.get("waf:block:127.0.0.1")).toBe("1");
    });

    it("does not hard block after only a few suspicious user-agent requests", async () => {
        const attemptsBeforeMediumRisk = Math.floor(
            (WAF_CONFIG.LIMITS.MEDIUM_RISK.threshold - 1) / WAF_CONFIG.UA_SCORE,
        );

        for (let i = 0; i < attemptsBeforeMediumRisk; i += 1) {
            const res = await withHeaders(request(app).get("/api/normal"), {
                "User-Agent": "curl/7.64.1",
                "X-Tid": `brief${i}-span`,
            });
            expect(res.status).toBe(200);
        }

        const ipRecord = parseRecord(await redis.get("waf:record:127.0.0.1"));
        expect(ipRecord.riskLevel).toBeLessThan(WAF_CONFIG.LIMITS.MEDIUM_RISK.threshold);
        expect(await redis.get("waf:block:127.0.0.1")).toBeNull();
    });

    it("does not lose counts during concurrent requests from the same IP", async () => {
        const limit = WAF_CONFIG.LIMITS.LOW_RISK.total;
        const responses = await Promise.all(
            Array.from({ length: limit + 1 }, (_value, index) =>
                withHeaders(request(app).get("/api/normal"), {
                    "X-Tid": `concurrent-${index}-span`,
                }),
            ),
        );

        const ipRecord = parseRecord(await redis.get("waf:record:127.0.0.1"));
        expect(ipRecord.count).toBe(limit + 1);
        expect(responses.some((res) => res.status === 429)).toBe(true);
        expect(ipRecord.totalLimitExceeded).toBe(true);
        expect(ipRecord.riskLevel).toBe(WAF_CONFIG.RATE_LIMIT_EXCEEDED_SCORE);
        expect(await redis.get("waf:block:127.0.0.1")).toBeNull();
    });

    it("does not double count total requests when SensitiveAPIWAF runs after WAF", async () => {
        const res = await withHeaders(request(app).get("/api/sensitive"));

        const ipRecord = parseRecord(await redis.get("waf:record:127.0.0.1"));
        expect(res.status).toBe(200);
        expect(ipRecord.count).toBe(1);
        expect(ipRecord.sensitiveCount).toBe(1);
    });

    it("blocks sensitive APIs when the sensitive count limit is exceeded without double counting total requests", async () => {
        const record = new RateLimitRecord({ id: "127.0.0.1" });
        record.sensitiveCount = WAF_CONFIG.LIMITS.LOW_RISK.sensitive;
        await record.save();

        const res = await withHeaders(request(app).get("/api/sensitive"));

        const ipRecord = parseRecord(await redis.get("waf:record:127.0.0.1"));
        expect(res.status).toBe(429);
        expect(ipRecord.count).toBe(1);
        expect(ipRecord.sensitiveCount).toBe(WAF_CONFIG.LIMITS.LOW_RISK.sensitive + 1);
        expect(ipRecord.sensitiveLimitExceeded).toBe(true);
        expect(ipRecord.riskLevel).toBe(WAF_CONFIG.SENSITIVE_RATE_LIMIT_EXCEEDED_SCORE);
        expect(await redis.get("waf:block:127.0.0.1")).toBeNull();
    });

    it("writes a block key when sensitive API risk reaches the sensitive hard-block threshold", async () => {
        const record = new RateLimitRecord({ id: "127.0.0.1" });
        record.riskLevel = WAF_CONFIG.RISK_LIMIT_SENSITIVE_BLOCK;
        await record.save();

        const res = await withHeaders(request(app).get("/api/sensitive"));

        expect(res.status).toBe(429);
        expect(await redis.get("waf:block:127.0.0.1")).toBe("1");
    });

    it("persists latest IP and trace ID state before denying an already blocked request", async () => {
        await redis.setex("waf:block:127.0.0.1", WAF_CONFIG.BLOCK_DURATION_MS / 1000, "1");

        const res = await withHeaders(request(app).get("/api/normal"), {
            "User-Agent": "curl/7.64.1",
            "X-Tid": "blocked-span",
        });

        const ipRecord = parseRecord(await redis.get("waf:record:127.0.0.1"));
        const tidRecord = parseRecord(await redis.get("waf:record:blocked"));
        expect(res.status).toBe(429);
        expect(ipRecord.count).toBe(1);
        expect(ipRecord.riskLevel).toBeGreaterThanOrEqual(WAF_CONFIG.UA_SCORE);
        expect(ipRecord.relatedIdentifiers).toContain("blocked");
        expect(tidRecord.count).toBe(1);
        expect(tidRecord.relatedIdentifiers).toContain("127.0.0.1");
    });
});
