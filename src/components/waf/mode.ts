import { WAF_CURRENT_MODE, WAF_MODE } from "../../config.js";

export type WafModeName = "BYPASS" | "MONITOR" | "BLOCK";

let currentMode: WAF_MODE = parseWafMode(WAF_CURRENT_MODE) ?? WAF_MODE.MONITOR;

export function parseWafMode(mode: unknown): WAF_MODE | null {
    if (mode === WAF_MODE.BYPASS || mode === "BYPASS") {
        return WAF_MODE.BYPASS;
    }
    if (mode === WAF_MODE.MONITOR || mode === "MONITOR") {
        return WAF_MODE.MONITOR;
    }
    if (mode === WAF_MODE.BLOCK || mode === "BLOCK") {
        return WAF_MODE.BLOCK;
    }
    return null;
}

export function getWafModeName(): WafModeName {
    const mode = getWafMode();
    if (mode === WAF_MODE.BYPASS) {
        return "BYPASS";
    }
    if (mode === WAF_MODE.MONITOR) {
        return "MONITOR";
    }
    return "BLOCK";
}

export function getWafMode(): WAF_MODE {
    return currentMode;
}

export function setWafMode(mode: WAF_MODE) {
    currentMode = parseWafMode(mode) ?? WAF_MODE.MONITOR;
}
