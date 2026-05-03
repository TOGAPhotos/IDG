import { Redis } from "ioredis";
import { REDIS_DB_PASS } from "../../config.js";
import { WAF_CONFIG } from "./config.js";
import Log from "../loger.js";

export const redis = new Redis({
    password: REDIS_DB_PASS || undefined
});

const WAF_RECORD_UPDATE_SCRIPT = `
local key = KEYS[1]
local params = cjson.decode(ARGV[1])
local raw = redis.call("GET", key)
local record = nil

if raw then
    local ok, parsed = pcall(cjson.decode, raw)
    if ok and type(parsed) == "table" then
        record = parsed
    end
end

if not record then
    record = {}
end

local now = tonumber(params.now)
local risk_level = tonumber(record.riskLevel) or 0
local last_active = tonumber(record.lastActive) or now
local window_start = tonumber(record.windowStart) or now
local count = tonumber(record.count) or 0
local sensitive_count = tonumber(record.sensitiveCount) or 0

if risk_level > 0 and now - last_active > tonumber(params.riskDecayTimeMs) then
    risk_level = math.max(0, risk_level - tonumber(params.riskDecayAmount))
end

if now - window_start > tonumber(params.windowSizeMs) then
    count = 0
    sensitive_count = 0
    window_start = now
end

risk_level = risk_level + tonumber(params.addRisk or 0)

if params.incrementCount then
    count = count + 1
end

if params.incrementSensitive then
    sensitive_count = sensitive_count + 1
end

local related_set = {}
local related_array = {}

if type(record.relatedIdentifiers) == "table" then
    for _, identifier in pairs(record.relatedIdentifiers) do
        if identifier and identifier ~= "" then
            local normalized = tostring(identifier)
            if not related_set[normalized] then
                related_set[normalized] = true
                table.insert(related_array, normalized)
            end
        end
    end
end

if type(params.relatedIdentifiers) == "table" then
    for _, identifier in ipairs(params.relatedIdentifiers) do
        if identifier and identifier ~= "" then
            local normalized = tostring(identifier)
            if not related_set[normalized] then
                related_set[normalized] = true
                table.insert(related_array, normalized)
            end
        end
    end
end

if params.applyRateLimitPenalty then
    local total_limit = tonumber(params.lowRiskTotal)
    local sensitive_limit = tonumber(params.lowRiskSensitive)

    if risk_level > tonumber(params.highRiskThreshold) then
        total_limit = tonumber(params.highRiskTotal)
        sensitive_limit = tonumber(params.highRiskSensitive)
    elseif risk_level >= tonumber(params.mediumRiskThreshold) then
        total_limit = tonumber(params.mediumRiskTotal)
        sensitive_limit = tonumber(params.mediumRiskSensitive)
    end

    local total_exceeded = params.checkTotalLimit and count > total_limit
    local sensitive_exceeded = params.checkSensitiveLimit and sensitive_count > sensitive_limit

    if total_exceeded then
        risk_level = risk_level + tonumber(params.rateLimitExceededScore)
    end

    if sensitive_exceeded then
        risk_level = risk_level + tonumber(params.sensitiveRateLimitExceededScore)
    end

    record.totalLimitExceeded = total_exceeded
    record.sensitiveLimitExceeded = sensitive_exceeded
else
    record.totalLimitExceeded = false
    record.sensitiveLimitExceeded = false
end

record.id = params.id
record.riskLevel = risk_level
record.lastActive = now
record.windowStart = window_start
record.count = count
record.sensitiveCount = sensitive_count
record.relatedIdentifiers = related_array

local encoded = cjson.encode(record)
redis.call("SETEX", key, tonumber(params.ttlSeconds), encoded)
return encoded
`;

export interface RateLimitRecordUpdate {
    addRisk?: number;
    incrementCount?: boolean;
    incrementSensitive?: boolean;
    relatedIdentifiers?: string[];
    applyRateLimitPenalty?: boolean;
    checkTotalLimit?: boolean;
    checkSensitiveLimit?: boolean;
}

export class RateLimitRecord {
    id: string;
    riskLevel: number;
    lastActive: number;
    windowStart: number;
    count: number;
    sensitiveCount: number;
    relatedIdentifiers: Set<string>;
    totalLimitExceeded: boolean;
    sensitiveLimitExceeded: boolean;

    constructor(data?: Partial<RateLimitRecord>) {
        this.id = data?.id || '';
        this.riskLevel = data?.riskLevel ?? 0;
        this.lastActive = data?.lastActive ?? Date.now();
        this.windowStart = data?.windowStart ?? Date.now();
        this.count = data?.count ?? 0;
        this.sensitiveCount = data?.sensitiveCount ?? 0;
        this.totalLimitExceeded = data?.totalLimitExceeded ?? false;
        this.sensitiveLimitExceeded = data?.sensitiveLimitExceeded ?? false;

        if (data?.relatedIdentifiers) {
            if (data.relatedIdentifiers instanceof Set) {
                this.relatedIdentifiers = data.relatedIdentifiers;
            } else if (Array.isArray(data.relatedIdentifiers)) {
                this.relatedIdentifiers = new Set(data.relatedIdentifiers);
            } else if (typeof data.relatedIdentifiers === "object") {
                this.relatedIdentifiers = new Set(Object.values(data.relatedIdentifiers));
            } else {
                this.relatedIdentifiers = new Set<string>();
            }
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

    static async updateAtomic(id: string, update: RateLimitRecordUpdate = {}): Promise<RateLimitRecord> {
        const params = {
            id,
            now: Date.now(),
            ttlSeconds: Math.ceil(WAF_CONFIG.RECORD_TTL_MS / 1000),
            windowSizeMs: WAF_CONFIG.WINDOW_SIZE_MS,
            riskDecayTimeMs: WAF_CONFIG.RISK_DECAY_TIME_MS,
            riskDecayAmount: WAF_CONFIG.RISK_DECAY_AMOUNT,
            addRisk: update.addRisk ?? 0,
            incrementCount: update.incrementCount ?? false,
            incrementSensitive: update.incrementSensitive ?? false,
            relatedIdentifiers: update.relatedIdentifiers ?? [],
            applyRateLimitPenalty: update.applyRateLimitPenalty ?? false,
            checkTotalLimit: update.checkTotalLimit ?? false,
            checkSensitiveLimit: update.checkSensitiveLimit ?? false,
            rateLimitExceededScore: WAF_CONFIG.RATE_LIMIT_EXCEEDED_SCORE,
            sensitiveRateLimitExceededScore: WAF_CONFIG.SENSITIVE_RATE_LIMIT_EXCEEDED_SCORE,
            highRiskThreshold: WAF_CONFIG.LIMITS.HIGH_RISK.threshold,
            highRiskTotal: WAF_CONFIG.LIMITS.HIGH_RISK.total,
            highRiskSensitive: WAF_CONFIG.LIMITS.HIGH_RISK.sensitive,
            mediumRiskThreshold: WAF_CONFIG.LIMITS.MEDIUM_RISK.threshold,
            mediumRiskTotal: WAF_CONFIG.LIMITS.MEDIUM_RISK.total,
            mediumRiskSensitive: WAF_CONFIG.LIMITS.MEDIUM_RISK.sensitive,
            lowRiskTotal: WAF_CONFIG.LIMITS.LOW_RISK.total,
            lowRiskSensitive: WAF_CONFIG.LIMITS.LOW_RISK.sensitive,
        };

        const data = await redis.eval(
            WAF_RECORD_UPDATE_SCRIPT,
            1,
            `waf:record:${id}`,
            JSON.stringify(params),
        );
        const record = new RateLimitRecord(JSON.parse(String(data)));
        Log.debug(`WAF: Atomically updated RateLimitRecord for ${id}: ${String(data)}`);
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
            totalLimitExceeded: this.totalLimitExceeded,
            sensitiveLimitExceeded: this.sensitiveLimitExceeded,
            relatedIdentifiers: Array.from(this.relatedIdentifiers)
        };
        await redis.setex(`waf:record:${this.id}`, WAF_CONFIG.RECORD_TTL_MS / 1000, JSON.stringify(data));
        Log.debug(`WAF: Saved RateLimitRecord for ${this.id}: ${JSON.stringify(data)}`);
    }
}
