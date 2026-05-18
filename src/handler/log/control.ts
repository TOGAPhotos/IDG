import { Request, Response } from "express";
import Log from "../../components/loger.js";
import { getServiceMode, parseServiceMode, setServiceMode } from "../../components/serviceMode.js";
import { getWafModeName, parseWafMode, setWafMode } from "../../components/waf/mode.js";
import { HTTP_STATUS } from "../../types/http_code.js";

function accessActor(req: Request) {
  return {
    email: req.cfAccess?.email || "UNKNOWN",
    sub: req.cfAccess?.sub || "UNKNOWN",
  };
}

function currentState() {
  return {
    wafMode: getWafModeName(),
    serviceMode: getServiceMode(),
  };
}

export default class LogControlHandler {
  public static async state(req: Request, res: Response) {
    return res.success("OK", currentState());
  }

  public static async setWafMode(req: Request, res: Response) {
    const requestedMode = req.body?.mode;
    const mode = typeof requestedMode === "string" ? parseWafMode(requestedMode) : null;
    if (mode === null) {
      return res.fail(HTTP_STATUS.BAD_REQUEST, "Invalid WAF mode");
    }

    const oldMode = getWafModeName();
    setWafMode(mode);
    const newMode = getWafModeName();
    Log.warn(
      `Log control WAF mode changed actor:${JSON.stringify(accessActor(req))} old:${oldMode} new:${newMode}`,
    );
    return res.success("OK", currentState());
  }

  public static async setServiceMode(req: Request, res: Response) {
    const mode = parseServiceMode(req.body?.mode);
    if (mode === null) {
      return res.fail(HTTP_STATUS.BAD_REQUEST, "Invalid service mode");
    }

    const oldMode = getServiceMode();
    setServiceMode(mode);
    const newMode = getServiceMode();
    Log.warn(
      `Log control service mode changed actor:${JSON.stringify(accessActor(req))} old:${oldMode} new:${newMode}`,
    );
    return res.success("OK", currentState());
  }
}
