// filepath: /Users/794td/Repo/TOGAPhotos/IDG/src/router/log.ts
import { Router } from "express";
import CloudflareAccess from "../components/auth/cloudflareAccess.js";
import LogStreamHandler from "../handler/log/index.js";

const logRouter = Router();

logRouter.get("/stream", CloudflareAccess.requireAccessMW, LogStreamHandler.stream);

export default logRouter;
