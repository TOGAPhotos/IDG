// filepath: /Users/794td/Repo/TOGAPhotos/IDG/src/router/log.ts
import { Router } from "express";
import Permission from "../components/auth/permissions.js";
import LogStreamHandler from "../handler/log/index.js";

const logRouter = Router();

// 需要管理员权限，防止日志泄露
logRouter.use(Permission.isLoginMW);
logRouter.get("/stream", Permission.isAdminMW, LogStreamHandler.stream);

export default logRouter;

