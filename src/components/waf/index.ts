import type { NextFunction, Request, Response } from "express";
import Log from '../../components/loger.js';
import { WAF_MODE } from "../../config.js";
import { WAF_CONFIG, getRateLimit } from "./config.js";
import { RateLimitRecord, redis } from "./store.js";
import { rules } from "./rules.js";
import { denyRequest } from "./action.js";
import { getWafMode, setWafMode } from "./mode.js";

export { setWafMode };

async function blockIdentifier(id: string) {
    await redis.setex(`waf:block:${id}`, WAF_CONFIG.BLOCK_DURATION_MS / 1000, '1');
}

function getShortTid(tId: string | undefined): string | null {
    if (!tId || tId === "NO_TRACE_ID") {
        return null;
    }
    return tId.split("-")[0];
}

function getRequestRisk(req: Request): number {
    let riskLevel = 0;
    for (const rule of rules) {
        riskLevel += rule(req);
    }
    return riskLevel;
}

async function blockRecordIdentifiers(ip: string, shortTid: string | null, ipRecord: RateLimitRecord) {
    const identifiers = new Set<string>([ip]);
    if (shortTid) {
        identifiers.add(shortTid);
    }
    for (const identifier of ipRecord.relatedIdentifiers) {
        identifiers.add(identifier);
    }
    await Promise.all(Array.from(identifiers).map(blockIdentifier));
}

async function handleRateLimit(req: Request, res: Response, next: NextFunction, isSensitive: boolean) {
    if (getWafMode() === WAF_MODE.BYPASS) {
        return next();
    }

    const ip = req.userIp || req.ip;
    const shortTid = getShortTid(req.tId);
    const alreadyRateLimitChecked = req.rateLimitChecked === true;
    const shouldCountTotal = !alreadyRateLimitChecked;
    const requestRisk = alreadyRateLimitChecked ? 0 : getRequestRisk(req);

    const ipRecord = await RateLimitRecord.updateAtomic(ip, {
        addRisk: requestRisk,
        incrementCount: shouldCountTotal,
        incrementSensitive: isSensitive,
        relatedIdentifiers: shortTid ? [shortTid] : [],
        applyRateLimitPenalty: true,
        checkTotalLimit: shouldCountTotal,
        checkSensitiveLimit: isSensitive,
    });
    let tidRecord: RateLimitRecord | null = null;

    if (shortTid) {
        tidRecord = await RateLimitRecord.updateAtomic(shortTid, {
            incrementCount: shouldCountTotal,
            incrementSensitive: isSensitive,
            relatedIdentifiers: [ip],
        });
    }

    if (await redis.exists(`waf:block:${ip}`)) {
        return denyRequest(res, next);
    }

    if (shortTid && await redis.exists(`waf:block:${shortTid}`)) {
        return denyRequest(res, next);
    }

    const riskLevel = ipRecord.riskLevel;
    const limits = getRateLimit(riskLevel);
    Log.debug(`WAF: Req:${req.userIp}/${req.tId} Count:${ipRecord.count}/${limits.total} SensitiveCount:${ipRecord.sensitiveCount}/${limits.sensitiveAPI} Risk:${riskLevel} TidRisk:${tidRecord?.riskLevel ?? "N/A"}`);

    const hardBlockRiskLimit = isSensitive
        ? Math.min(WAF_CONFIG.RISK_LIMIT_BLOCK, WAF_CONFIG.RISK_LIMIT_SENSITIVE_BLOCK)
        : WAF_CONFIG.RISK_LIMIT_BLOCK;

    if (riskLevel >= hardBlockRiskLimit) {
        await blockRecordIdentifiers(ip, shortTid, ipRecord);

        Log.warn(`WAF: Blocked IP ${ip} and related identifiers due to high risk level ${riskLevel}`);

        return denyRequest(res, next);
    }

    if (isSensitive && riskLevel >= WAF_CONFIG.LIMITS.MEDIUM_RISK.threshold) {
        return denyRequest(res, next);
    }

    if (ipRecord.totalLimitExceeded || (isSensitive && ipRecord.sensitiveLimitExceeded)) {
        return denyRequest(res, next);
    }

    Log.debug(`WAF: Passed req:${req.userIp}/${req.tId} with risk level ${riskLevel}`);
    req.rateLimitChecked = true;
    next();
}

export async function SensitiveAPIWAF(req: Request, res: Response, next: NextFunction) {
    await handleRateLimit(req, res, next, true);
}

export async function WAF(req: Request, res: Response, next: NextFunction) {
    await handleRateLimit(req, res, next, false);
}
