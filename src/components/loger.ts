import { createLogger, format, transports } from "winston";
import "winston-daily-rotate-file";
import chalk from "chalk";
import { type Request, type Response, type NextFunction } from "express";
import Time from "./time.js";
import { PRODUCTION_ENV } from "../config.js";
import { publishLogEvent } from "./logStream.js";

const customFormat = format.combine(
  format.timestamp({ format: "MMM-DD-YYYY HH:mm:ss" }),
  format.align(),
  format.printf((i) => `${i.level}: ${[i.timestamp]}: ${i.message}`),
);
const defaultOptions = {
  format: customFormat,
  datePattern: "YYYY-MM-DD",
  zippedArchive: true,
  maxSize: "20m",
  // maxFiles: "14d",
};

const Logger = createLogger({
  format: customFormat,
  transports: [
    new transports.DailyRotateFile({
      filename: "log/info-%DATE%.log",
      level: "info",
      ...defaultOptions,
    }),
    new transports.DailyRotateFile({
      filename: "log/error-%DATE%.log",
      level: "error",
      ...defaultOptions,
    }),
    new transports.DailyRotateFile({
      filename: "log/debug-%DATE%.log",
      level: "debug",
      ...defaultOptions,
    }),
  ],
});

export default class Log {
  private static DEBUG_MODE = !PRODUCTION_ENV;
  static setDebugMode(mode: boolean) {
    if(!PRODUCTION_ENV && !mode){
      return;
    }
    Log.DEBUG_MODE = mode;
    Log.warn("Debug mode set to " + mode);
  }
  static debug = (message:string) => {
    if (!Log.DEBUG_MODE) {
      return;
    }
      console.debug(Time.getUTCTime() + ": " + message);
      Logger.debug(message);
      publishLogEvent("debug", message);
  }

  static info(message: string) {
    console.log(Time.getUTCTime() + ": " + message);
    Logger.info(message);
    publishLogEvent("info", message);
  }

  static warn(message: string) {
    console.warn(chalk.bgYellow.bold(Time.getUTCTime() + ": " + message));
    Logger.warn(message);
    publishLogEvent("warn", message);
  }

  static error(message: string) {
    console.error(chalk.bgRed.bold(Time.getUTCTime() + ": " + message));
    Logger.error(message);
    publishLogEvent("error", message);
  }

  static accessLogMW(req: Request, res: Response, next: NextFunction) {
    req.userIp = (req.headers["x-real-ip"] as string) || req.ip;
    req.tId = (req.headers["t_id"] as string) || "NO_TRACE_ID";
    if (!Log.DEBUG_MODE) {
        Logger.info(
          `${req.userIp} ${req.method} ${req.url} userId:${req.token?.id || "NOT LOGIN"} trace_id:${req.tId} ${JSON.stringify(req.body)}`,
        );
    } else {
      Logger.info(
        `${req.userIp} ${req.method} ${req.url} userId:${req.token?.id || "NOT LOGIN"} trace_id:${req.tId} ${JSON.stringify(req.body)}`,
      );
      Log.debug(
        `${req.userIp} ${req.method} ${req.url} userId:${req.token?.id || "NOT LOGIN"} trace_id:${req.tId} ${JSON.stringify(req.body)}`,
      );
    }
    next();
  }
}
