import Log from "./components/loger.js";
import bell from "./components/bell.js";
import StartHTTPServer from "./server.js";

import "dotenv/config";
import ErrorHandler from "./components/errorHandler.js";
import { PRODUCTION_ENV, REDIS_DB_PASS, startConsoleStr } from "./config.js";
import RegisterService from "./components/registerService/index.js";
import { registerScheduleJob } from "./components/schedule.js";
import { Redis } from "ioredis";

declare global {
  interface BigInt {
    toJSON(): string;
  }
}

BigInt.prototype.toJSON = function () {
  return this.toString();
};

Log.info(startConsoleStr);

process.on("uncaughtException", ErrorHandler.syncError);
process.on("unhandledRejection", ErrorHandler.asyncError);
process.on("exit", async (code) => {
  await bell("TOGAPhotos API离线", "退出代码" + code);
  RegisterService.stopAll();
});

const redis = new Redis({ password: REDIS_DB_PASS });
await redis.flushall()
redis.disconnect()

// 启动HTTP服务器
StartHTTPServer();

// 启动消息队列消费者
const mailService = new RegisterService("mail", "./dist/service/mail/index.js");
const imageProcessService = new RegisterService(
  "imageProcess",
  "./dist/service/imageProcesser/index.js",
);

registerScheduleJob();
