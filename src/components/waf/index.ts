import type { NextFunction, Request, Response } from "express";
import Log from '../../components/loger.js';
import { WAF_MODE } from "../../config.js";
import { WAF_CONFIG, getRateLimit } from "./config.js";
import { RateLimitRecord, redis } from "./store.js";
import { rules } from "./rules.js";
import { denyRequest } from "./action.js";
import { getWafMode, setWafMode } from "./mode.js";
import { isLogControlPath } from "../../lib/logControlPath.js";

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

async function blockRecordIdentifiers(ip: string, shortTid: string | null, records: RateLimitRecord[]) {
    const identifiers = new Set<string>([ip]);
    if (shortTid) {
        identifiers.add(shortTid);
    }
    for (const record of records) {
        for (const identifier of record.relatedIdentifiers) {
            identifiers.add(identifier);
        }
    }
    await Promise.all(Array.from(identifiers).map(blockIdentifier));
}

function hasRateLimitExceeded(record: RateLimitRecord, isSensitive: boolean) {
    return record.totalLimitExceeded || (isSensitive && record.sensitiveLimitExceeded);
}

async function handleRateLimit(req: Request, res: Response, next: NextFunction, isSensitive: boolean) {
    if (isLogControlPath(req.path)) {
        return next();
    }

    if (getWafMode() === WAF_MODE.BYPASS) {
        return next();
    }

    const ip = (req.userIp || req.ip)!;
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
            addRisk: requestRisk,
            incrementCount: shouldCountTotal,
            incrementSensitive: isSensitive,
            relatedIdentifiers: [ip],
            applyRateLimitPenalty: true,
            checkTotalLimit: shouldCountTotal,
            checkSensitiveLimit: isSensitive,
        });
    }

    if (await redis.exists(`waf:block:${ip}`)) {
        return denyRequest(res, next);
    }

    if (shortTid && await redis.exists(`waf:block:${shortTid}`)) {
        return denyRequest(res, next);
    }

    const recordsToEnforce = tidRecord ? [ipRecord, tidRecord] : [ipRecord];
    const riskLevel = Math.max(...recordsToEnforce.map((record) => record.riskLevel));
    const ipLimits = getRateLimit(ipRecord.riskLevel);
    const tidLimits = tidRecord ? getRateLimit(tidRecord.riskLevel) : null;
    Log.debug(`WAF: Req:${req.userIp}/${req.tId} IPCount:${ipRecord.count}/${ipLimits.total} IPSensitiveCount:${ipRecord.sensitiveCount}/${ipLimits.sensitiveAPI} IPRisk:${ipRecord.riskLevel} TidCount:${tidRecord && tidLimits ? `${tidRecord.count}/${tidLimits.total}` : "N/A"} TidSensitiveCount:${tidRecord && tidLimits ? `${tidRecord.sensitiveCount}/${tidLimits.sensitiveAPI}` : "N/A"} TidRisk:${tidRecord?.riskLevel ?? "N/A"}`);

    const hardBlockRiskLimit = isSensitive
        ? Math.min(WAF_CONFIG.RISK_LIMIT_BLOCK, WAF_CONFIG.RISK_LIMIT_SENSITIVE_BLOCK)
        : WAF_CONFIG.RISK_LIMIT_BLOCK;

    if (riskLevel >= hardBlockRiskLimit) {
        await blockRecordIdentifiers(ip, shortTid, recordsToEnforce);

        Log.warn(`WAF: Blocked IP ${ip} and related identifiers due to high risk level ${riskLevel}`);

        return denyRequest(res, next);
    }

    if (isSensitive && riskLevel >= WAF_CONFIG.LIMITS.MEDIUM_RISK.threshold) {
        return denyRequest(res, next);
    }

    if (recordsToEnforce.some((record) => hasRateLimitExceeded(record, isSensitive))) {
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
