import { createLogger, format, transports } from "winston";
import "winston-daily-rotate-file";
import chalk from "chalk";
import { type Request, type Response, type NextFunction } from "express";
import Time from "./time.js";
import { PRODUCTION_ENV } from "../config.js";

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
  static success(message: string) {
    console.log(chalk.bgGreen.bold(Time.getUTCTime() + ": " + message));
    Logger.info(message);
  }

  static debug = (() => {
    if (PRODUCTION_ENV) {
      return () => {};
    } else {
      return (message: string) => {
        console.debug(Time.getUTCTime() + ": " + message);
        Logger.debug(message);
      };
    }
  })();

  static info(message: string) {
    console.log(Time.getUTCTime() + ": " + message);
    Logger.info(message);
  }

  static warn(message: string) {
    console.warn(chalk.bgYellow.bold(Time.getUTCTime() + ": " + message));
    Logger.warn(message);
  }

  static error(message: string) {
    console.error(chalk.bgRed.bold(Time.getUTCTime() + ": " + message));
    Logger.error(message);
  }

  static accessLogMW() {
    if (PRODUCTION_ENV) {
      return function (req: Request, res: Response, next: NextFunction) {
        req.userIp = (req.headers["x-real-ip"] as string) || req.ip;
        req.tId = (req.headers["t_id"] as string) || "NO_TRACE_ID";
        Logger.info(
          `${req.userIp} ${req.method} ${req.url} userId:${req.token?.id || "NOT LOGIN"} trace_id:${req.tId} ${JSON.stringify(req.body)}`,
        );
        next();
      };
    } else {
      return function (req: Request, res: Response, next: NextFunction) {
        req.userIp = (req.headers["x-real-ip"] as string) || req.ip;
        req.tId = (req.headers["t_id"] as string) || "NO_TRACE_ID";
        Log.debug(
          `${req.userIp} ${req.method} ${req.url} userId:${req.token?.id || "NOT LOGIN"} trace_id:${req.tId} ${JSON.stringify(req.body)}`,
        );
        next();
      };
    }
  }
}
