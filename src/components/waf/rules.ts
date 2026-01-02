import type { Request } from "express";
import { BACK_LIST_UA_REGEX, LEGAL_REQ_HEADERS } from "../../config.js";
import { WAF_CONFIG } from "./config.js";

const checkHeaders = (req: Request): number => {
    let missingHeaders = 0;
    for (const header of LEGAL_REQ_HEADERS) {
        const v = req.headers[header];
        if (v === undefined || v === null || v === '') {
            missingHeaders += 1;
        }
    }
    return missingHeaders * 2;
}

function isSuspiciousUA(req: Request): number {
    const ua = req.headers['user-agent'];
    if (!ua) {
        return WAF_CONFIG.UA_SCORE;
    }
    return BACK_LIST_UA_REGEX.test(ua) ? WAF_CONFIG.UA_SCORE : 0;
}

function noTraceId(req: Request): number {
    return req.tId === "NO_TRACE_ID" ? WAF_CONFIG.NO_TRACE_ID_SCORE : 0;
}

export const rules = [
    checkHeaders,
    isSuspiciousUA,
    noTraceId
];
