export const WAF_CONFIG = {
    WINDOW_SIZE_MS: 60 * 1000,          // 1 minute
    RECORD_TTL_MS: 30 * 60 * 1000,      // 30 minutes inactive removal
    RISK_DECAY_TIME_MS: 3 * 60 * 1000,  // 3 minutes decay
    BLOCK_DURATION_MS: 60 * 60 * 1000,  // 1 hour block
    RISK_DECAY_AMOUNT: 10,
    RISK_LIMIT_BLOCK: 200,
    RISK_LIMIT_SENSITIVE_BLOCK: 60,
    UA_SCORE: 20,
    NO_TRACE_ID_SCORE: 30,
    LIMITS: {
        HIGH_RISK: { threshold: 90, total: 0, sensitive: 0 },
        MEDIUM_RISK: { threshold: 60, total: 20, sensitive: 5 },
        LOW_RISK: { threshold: 0, total: 100, sensitive: 20 },
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
