// filepath: /Users/794td/Repo/TOGAPhotos/IDG/src/router/log.ts
import { Router } from "express";
import CloudflareAccess from "../components/auth/cloudflareAccess.js";
import LogControlHandler from "../handler/log/control.js";
import LogStreamHandler from "../handler/log/index.js";

const logRouter = Router();

logRouter.get("/control/state", CloudflareAccess.requireAccessMW, LogControlHandler.state);
logRouter.put("/control/waf-mode", CloudflareAccess.requireAccessMW, LogControlHandler.setWafMode);
logRouter.put("/control/service-mode", CloudflareAccess.requireAccessMW, LogControlHandler.setServiceMode);
logRouter.get("/stream", CloudflareAccess.requireAccessMW, LogStreamHandler.stream);

export default logRouter;
