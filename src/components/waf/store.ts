import { Redis } from "ioredis";
import { REDIS_DB_PASS } from "../../config.js";
import { WAF_CONFIG } from "./config.js";
import Log from "../loger.js";
import { da } from "zod/locales";

export const redis = new Redis({
    password: REDIS_DB_PASS || undefined
});

export class RateLimitRecord {
    id: string;
    riskLevel: number;
    lastActive: number;
    windowStart: number;
    count: number;
    sensitiveCount: number;
    relatedIdentifiers: Set<string>;

    constructor(data?: Partial<RateLimitRecord>) {
        this.id = data?.id || '';
        this.riskLevel = data?.riskLevel ?? 0;
        this.lastActive = data?.lastActive ?? Date.now();
        this.windowStart = data?.windowStart ?? Date.now();
        this.count = data?.count ?? 0;
        this.sensitiveCount = data?.sensitiveCount ?? 0;

        if (data?.relatedIdentifiers) {
            this.relatedIdentifiers = data.relatedIdentifiers instanceof Set
                ? data.relatedIdentifiers
                : new Set(data.relatedIdentifiers);
        } else {
            this.relatedIdentifiers = new Set<string>();
        }
    }

    touch() {
        this.lastActive = Date.now();
    }

    private checkWindow() {
        const now = Date.now();
        if (now - this.windowStart > WAF_CONFIG.WINDOW_SIZE_MS) {
            this.count = 0;
            this.sensitiveCount = 0;
            this.windowStart = now;
        }
    }

    increment(): number {
        this.touch();
        this.checkWindow();
        this.count += 1;
        return this.count;
    }

    incrementSensitive(): number {
        this.touch();
        this.checkWindow();
        this.sensitiveCount += 1;
        return this.sensitiveCount;
    }

    addRelatedIdentifier(id: string) {
        this.relatedIdentifiers.add(id);
    }

    addRisk(level: number) {
        this.riskLevel += level;
        return this.riskLevel;
    }

    decayRisk() {
        if (this.riskLevel > 0) {
            this.riskLevel = Math.max(0, this.riskLevel - WAF_CONFIG.RISK_DECAY_AMOUNT);
        }
    }

    static async get(id: string): Promise<RateLimitRecord> {
        const data = await redis.get(`waf:record:${id}`);
        let record: RateLimitRecord;
        if (data) {
            try {
                const parsed = JSON.parse(data);
                record = new RateLimitRecord(parsed);
                // Apply decay if needed when loading
                const now = Date.now();
                if (now - record.lastActive > WAF_CONFIG.RISK_DECAY_TIME_MS) {
                    record.decayRisk();
                }
            } catch (e) {
                record = new RateLimitRecord({ id: id });
            }
        } else {
            record = new RateLimitRecord({ id: id });
        }
        return record;
    }

    async save() {
        const data = {
            id: this.id,
            riskLevel: this.riskLevel,
            lastActive: this.lastActive,
            windowStart: this.windowStart,
            count: this.count,
            sensitiveCount: this.sensitiveCount,
            relatedIdentifiers: Array.from(this.relatedIdentifiers)
        };
        await redis.setex(`waf:record:${this.id}`, WAF_CONFIG.RECORD_TTL_MS / 1000, JSON.stringify(data));
        Log.debug(`WAF: Saved RateLimitRecord for ${this.id}: ${JSON.stringify(data)}`);
    }
}

