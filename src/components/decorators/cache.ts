import type { Request, Response } from "express";
import { HTTP_STATUS } from "../../types/http_code.js";

interface ResponseCache {
  code: HTTP_STATUS;
  contentType: any;
  data: any;
  time: number;
}

const URL_CACHE_MAX_SIZE = 500;

const groupRegistry = new Map<string, Map<string, ResponseCache>>();

export function UrlCache(cacheSeconds: number, group?: string) {
  const cache = group
    ? groupRegistry.get(group) ??
      (groupRegistry.set(group, new Map<string, ResponseCache>()).get(group) as Map<string, ResponseCache>)
    : new Map<string, ResponseCache>();

  return function (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (
      req: Request,
      res: Response,
      ...args: any[]
    ) {
      const cachedResponse = cache.get(req.url);
      if (cachedResponse) {
        if (Date.now() - cachedResponse.time < cacheSeconds * 1000) {
          return res
            .status(cachedResponse.code)
            .setHeader("content-type", cachedResponse.contentType)
            .send(cachedResponse.data);
        }
      }

      const originalSend = res.send;
      res.send = function (body: any) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          if (cache.size >= URL_CACHE_MAX_SIZE) {
            cache.delete(cache.keys().next().value!);
          }
          cache.set(req.url, {
            code: res.statusCode,
            contentType: res.get("content-type"),
            data: body,
            time: Date.now(),
          });
        }
        return originalSend.apply(this, [body]);
      };
      return originalMethod.apply(this, [req, res, ...args]);
    };

    return descriptor;
  };
}

export function invalidateUrlCache(group: string): void {
  groupRegistry.get(group)?.clear();
}
