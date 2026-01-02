import express from "express";
import { Request, Response, NextFunction } from "express";
import cors from "cors";
import router from "./router/index.js";
import Log from "./components/loger.js";
import Token from "./components/auth/token.js";
import bell from "./components/bell.js";
import { CORS_WHITE_LIST, HTTP_PORT, PRODUCTION_ENV } from "./config.js";
import { success, fail } from "./exntend/response.js";
import { HTTP_STATUS } from "./types/http_code.js";
import voteSysRouter from "./router/vote.js";
import "express-async-errors";
import servexRouter from "./router/servex.js";
import logRouter from "./router/log.js";
import { WAF } from "./components/waf/index.js";

const server = express();

if (PRODUCTION_ENV) {
  server.use(
    cors({
      origin: CORS_WHITE_LIST,
    }),
  );
} else {
  server.use(cors());
}

server.use(express.json());

server.response.success = success;
server.response.fail = fail;

server.use((req: Request, res: Response, next: NextFunction) => {
  req.userIp = (req.headers["x-forwarded-for"] as string) || req.ip;
  req.tId = (req.headers["x-tid"] as string) || "NO_TRACE_ID";
  req.ua = req.headers["user-agent"] || "";
  next();
})
server.use(Token.verifyMW);
server.use(Log.accessLogMW);

server.use(WAF);

server.use("/api/v2/servex", servexRouter);
server.use("/api/v2/vote", voteSysRouter);
server.use("/api/v2/log", logRouter);
server.use("/api/v2", router);

server.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  Log.error(`${req.tId} ${err.message} ${err.stack}`);
  return res.fail(HTTP_STATUS.SERVER_ERROR, err.message);
});

export const app = server;

export default function StartHTTPServer() {
  server.listen(HTTP_PORT, async () => {
    // await bell('TOGAPhotos后端服务器',`${new Date().toString()}服务器启动`);
    Log.info("HTTP Server Start On localhost:" + HTTP_PORT);
  });
  return server;
}
