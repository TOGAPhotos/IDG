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

async function handleRateLimit(req: Request, res: Response, next: NextFunction, isSensitive: boolean) {
    if (getWafMode() === WAF_MODE.BYPASS) {
        return next();
    }

    const ip = req.userIp;
    if (await redis.exists(`waf:block:${ip}`)) {
        return denyRequest(res, next);
    }

    const shortTid: string | null = req.tId === "NO_TRACE_ID" ? null : req.tId.split("-")[0];
    if (shortTid && await redis.exists(`waf:block:${shortTid}`)) {
        return denyRequest(res, next);
    }

    let riskLevel = 0;
    for (const rule of rules) {
        riskLevel += rule(req);
    }

    const ipRecord = await RateLimitRecord.get(ip);
    let tidRecord: RateLimitRecord | null = null;

    if (shortTid) {
        ipRecord.addRelatedIdentifier(shortTid);

        tidRecord = await RateLimitRecord.get(shortTid);
        tidRecord.addRisk(riskLevel);
        tidRecord.addRelatedIdentifier(ip);
        await tidRecord.save();
    } else {
        ipRecord.addRisk(riskLevel);
    }

    riskLevel = Math.max(ipRecord.riskLevel, tidRecord ? tidRecord.riskLevel : 0);

    // Increment counts
    const currentCount = Math.max(ipRecord.increment(), tidRecord ? tidRecord.increment() : -1);
    const currentSensitiveCount = isSensitive ? Math.max(ipRecord.incrementSensitive(), tidRecord ? tidRecord.incrementSensitive() : -1) : ipRecord.sensitiveCount;

    // Check limits
    const limits = getRateLimit(riskLevel);
    Log.debug(`WAF: Req:${req.userIp}/${req.tId} Count:${currentCount}/${limits.total} SensitiveCount:${currentSensitiveCount}/${limits.sensitiveAPI} Risk:${riskLevel}`);
    if (currentCount > limits.total || (isSensitive && currentSensitiveCount > limits.sensitiveAPI)) {
        // Increase risk if limit exceeded

        if (shortTid && tidRecord) {
            ipRecord.addRisk(WAF_CONFIG.RISK_LIMIT_BLOCK / 4);
            tidRecord.addRisk(WAF_CONFIG.RISK_LIMIT_BLOCK);
        } else {
            ipRecord.addRisk(WAF_CONFIG.RISK_LIMIT_BLOCK);
        }

        riskLevel = Math.max(ipRecord.riskLevel, tidRecord ? tidRecord.riskLevel : 0);
    }

    if (isSensitive && riskLevel >= WAF_CONFIG.LIMITS.MEDIUM_RISK.threshold) {
        await ipRecord.save();
        return denyRequest(res, next);
    }

    if (riskLevel >= WAF_CONFIG.RISK_LIMIT_BLOCK) {
        await Promise.all([
            blockIdentifier(ip),
            ...ipRecord.relatedIdentifiers.values().map(id => blockIdentifier(id)),
            ipRecord.save()
        ]);

        Log.warn(`WAF: Blocked IP ${ip} and related identifiers due to high risk level ${riskLevel}`);

        return denyRequest(res, next);
    }

    await ipRecord.save();
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