import {createLogger, format, transports} from 'winston';
import 'winston-daily-rotate-file';
import chalk from 'chalk';

import Time from "./time.js";

const customFormat = format.combine(
    format.timestamp({format: "MMM-DD-YYYY HH:mm:ss"}),
    format.align(),
    format.printf((i) => `${i.level}: ${[i.timestamp]}: ${i.message}`)
);
const defaultOptions = {
    format: customFormat,
    datePattern: "YYYY-MM-DD",
    // zippedArchive: true,
    maxSize: "20m",
    // maxFiles: "14d",
};

const Logger = createLogger({
    format: customFormat,
    transports: [
        new transports.DailyRotateFile({
            filename: 'log/info-%DATE%.log',
            level: 'info',
            ...defaultOptions,
        }),
        new transports.DailyRotateFile({
            filename: 'log/error-%DATE%.log',
            level: 'error',
            ...defaultOptions,
        }),
    ]
});

export default class Log {
    static info(message: string) {
        if(message.includes('PUT') || message.includes('POST')){
            message = chalk.bgYellow.bold(message)
        }else if (message.includes('DELETE')){
            message = chalk.bgRed.bold(message)
        }
        console.log(Time.getUTCTime()+': '+message)
        Logger.info(`${Time.getUTCTime()}: ${message}\n`);
    }

    static error(message: string) {
        console.error(Time.getUTCTime()+': '+message)
        Logger.error(`${Time.getUTCTime()}: ${message}\n`);
    }
}