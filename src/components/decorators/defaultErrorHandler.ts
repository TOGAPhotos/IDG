import type { Request, Response, NextFunction } from "express";
import Log from "../loger.js";
import { HTTP_STATUS } from "@/types/http_code.js";


export function DefaultErrorFallback(
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (req: Request, res: Response, ...args: any[]) {
        try {
            return await originalMethod.apply(this, [req, res, ...args]);
        } catch (error) {
            Log.error(`error when ${req.tId} ${req.url} on ${propertyKey} occur: ${error}`)
            return res.fail(HTTP_STATUS.SERVER_ERROR, "服务器错误");
        }
    };

    return descriptor;
}
