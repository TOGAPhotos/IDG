import { WAF_CURRENT_MODE, WAF_MODE } from "../../config.js";

let currentMode: WAF_MODE = WAF_CURRENT_MODE;

export function getWafMode(): WAF_MODE {
    return currentMode;
}

export function setWafMode(mode: WAF_MODE) {
    currentMode = mode;
}
