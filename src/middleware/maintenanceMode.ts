import type { NextFunction, Request, Response } from "express";
import { MAINTENANCE_KEY } from "../config.js";
import { isLogControlPath } from "../lib/logControlPath.js";
import { getServiceMode, SERVICE_MODE } from "../components/serviceMode.js";
import { HTTP_STATUS } from "../types/http_code.js";

export function maintenanceModeMW(req: Request, res: Response, next: NextFunction) {
  if (isLogControlPath(req.path)) {
    return next();
  }

  if (getServiceMode() !== SERVICE_MODE.MAINTENANCE) {
    return next();
  }

  if (MAINTENANCE_KEY.length > 0 && req.headers["x-maintenance-key"] === MAINTENANCE_KEY) {
    return next();
  }

  return res.fail(HTTP_STATUS.SERVICE_UNAVAILABLE, "服务维护中");
}
