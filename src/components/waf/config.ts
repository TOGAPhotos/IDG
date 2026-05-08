export const WAF_CONFIG = {
    WINDOW_SIZE_MS: 60 * 1000,          // 1 minute
    RECORD_TTL_MS: 30 * 60 * 1000,      // 30 minutes inactive removal
    RISK_DECAY_TIME_MS: 3 * 60 * 1000,  // 3 minutes decay
    BLOCK_DURATION_MS: 60 * 60 * 1000,  // 1 hour block
    RISK_DECAY_AMOUNT: 10,
    RISK_LIMIT_BLOCK: 300,
    RISK_LIMIT_SENSITIVE_BLOCK: 220,
    RATE_LIMIT_EXCEEDED_SCORE: 35,
    SENSITIVE_RATE_LIMIT_EXCEEDED_SCORE: 45,
    MISSING_HEADER_SCORE: 1,
    UA_SCORE: 12,
    NO_TRACE_ID_SCORE: 8,
    LIMITS: {
        HIGH_RISK: { threshold: 180, total: 20, sensitive: 5 },
        MEDIUM_RISK: { threshold: 80, total: 60, sensitive: 15 },
        LOW_RISK: { threshold: 0, total: 180, sensitive: 40 },
    }
};

export const getRateLimit = (riskLevel: number): { total: number, sensitiveAPI: number } => {
    if (riskLevel > WAF_CONFIG.LIMITS.HIGH_RISK.threshold) {
        return { total: WAF_CONFIG.LIMITS.HIGH_RISK.total, sensitiveAPI: WAF_CONFIG.LIMITS.HIGH_RISK.sensitive };
    }
    if (riskLevel >= WAF_CONFIG.LIMITS.MEDIUM_RISK.threshold) {
        return { total: WAF_CONFIG.LIMITS.MEDIUM_RISK.total, sensitiveAPI: WAF_CONFIG.LIMITS.MEDIUM_RISK.sensitive };
    }
    return { total: WAF_CONFIG.LIMITS.LOW_RISK.total, sensitiveAPI: WAF_CONFIG.LIMITS.LOW_RISK.sensitive };
}
