import type { Request, Response } from "express";
import { HTTP_STATUS } from "../../types/http_code.js";
import Log from "../loger.js";

interface ResponseCache {
    code: HTTP_STATUS;
    contentType: any;
    data: any;
    time: number;
}

export function UrlCache(cacheSeconds: number) {
    const cache = new Map<string, ResponseCache>();

    return function (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (req: Request, res: Response, ...args: any[]) {
            const cachedResponse = cache.get(req.url);
            if (cachedResponse) {
                if (Date.now() - cachedResponse.time < cacheSeconds * 1000) {
                    return res.status(cachedResponse.code)
                        .setHeader("content-type", cachedResponse.contentType)
                        .send(cachedResponse.data);
                }
            }

            const originalSend = res.send;
            res.send = function (body: any) {
                cache.set(req.url, {
                    code: res.statusCode,
                    contentType: res.get("content-type"),
                    data: body,
                    time: Date.now(),
                });
                return originalSend.apply(this, [body]);
            };
            return originalMethod.apply(this, [req, res, ...args]);
        };

        return descriptor;
    }

}
