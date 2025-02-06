import {createLogger, format, transports} from 'winston';
import 'winston-daily-rotate-file';
import chalk from 'chalk';
import { type Request, type Response, type NextFunction } from "express";
import Time from "./time.js";
import { PRODUCTION_ENV } from '@/config.js';

const customFormat = format.combine(
    format.timestamp({format: "MMM-DD-YYYY HH:mm:ss"}),
    format.align(),
    format.printf((i) => `${i.level}: ${[i.timestamp]}: ${i.message}`)
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
            filename: 'log/info-%DATE%.log',
            level: 'info',
            ...defaultOptions,
        }),
        new transports.DailyRotateFile({
            filename: 'log/error-%DATE%.log',
            level: 'error',
            ...defaultOptions,
        }),
        new transports.DailyRotateFile({
            filename: 'log/debug-%DATE%.log',
            level: 'debug',
            ...defaultOptions,
        }),
    ]
});

export default class Log {
    static success(message: string) {
        console.log(chalk.bgGreen.bold(Time.getUTCTime()+': '+message))
        Logger.info(message);
    }

    static debug(message: string) {
        if( PRODUCTION_ENV ) return;
        console.debug(Time.getUTCTime()+': '+message)
        Logger.debug(message);
    }

    static info(message: string) {
        const _msg = message;
        // if(message.includes('PUT') || message.includes('POST')){
        //     message = chalk.bgYellow.bold(message)
        // }else if (message.includes('DELETE')){
        //     message = chalk.bgRed.bold(message)
        // }
        console.log(Time.getUTCTime()+': '+message)
        Logger.info(_msg);
    }

    static warn(message: string) {
        console.warn(chalk.bgYellow.bold(Time.getUTCTime()+': '+message))
        Logger.warn(message);
    }

    static error(message: string) {
        console.error(chalk.bgRed.bold(Time.getUTCTime()+': '+message))
        Logger.error(message);
    }

    static accessLogMW(){
        if ( PRODUCTION_ENV ) {
            return function(req:Request,res:Response,next:NextFunction){
                req.userIp = req.headers['x-real-ip'] as string || req.ip;
                Logger.info(`${req.userIp} ${req.method} ${req.url} userId:${req.token?.id || 'NOT LOGIN'} trace_id:${req.headers['t_id']} ${JSON.stringify(req.body)}`)
                next();
            }
        }else{
            return function(req:Request,res:Response,next:NextFunction){
                req.userIp = req.headers['x-real-ip'] as string || req.ip;
                const accessLog = `${req.userIp} ${req.method} ${req.url} userId:${req.token?.id || 'NOT LOGIN'} trace_id:${req.headers['t_id']} ${JSON.stringify(req.body)}`
                Log.debug(accessLog);
                next();
            }
        }
    }
}