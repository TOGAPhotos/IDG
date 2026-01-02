import { WAF_MODE } from "@/config.js";
import { setWafMode } from "../components/waf/mode.js";

export function BypassWAF() {
    setWafMode(WAF_MODE.BYPASS);
}