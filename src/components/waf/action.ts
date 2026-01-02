import type { NextFunction, Response } from "express";
import { HTTP_STATUS } from "@/types/http_code.js";
import Log from '../../components/loger.js';
import { WAF_MODE } from "../../config.js";
import { getWafMode } from "./mode.js";

export function denyRequest(res: Response, next: NextFunction) {
    const mode = getWafMode();
    if (mode === WAF_MODE.BLOCK) {
        Log.warn(`WAF:BLOCK Request ${res.req.userIp}/${res.req.tId} blocked by WAF.`);
        return res.fail(HTTP_STATUS.TOO_MANY_REQUESTS, "Your request has been blocked by WAF.");
    }
    if (mode === WAF_MODE.MONITOR) {
        Log.warn(`WAF:MONITOR Request ${res.req.userIp}/${res.req.tId} would be blocked by WAF, but in MONITOR mode.`);
        return next();
    }
    if (mode === WAF_MODE.BYPASS) {
        return next();
    }
    // Default fallback
    return next();
}
