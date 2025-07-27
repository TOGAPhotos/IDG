import Log from "../../components/loger.js";
import { Request } from "express";

export function ReqBodyCheck(...args: string[]) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    descriptor.value = function (...methodArgs: any[]) {
      const req = methodArgs[0];
      if (!req || !req.body) {
        throw new Error("Request body is required");
      }
      const missingArgs = args.filter((arg) => !(arg in req.body));
      if (missingArgs.length > 0) {
        throw new Error(
          `Missing required body parameters: ${missingArgs.join(", ")}`,
        );
      }
      return originalMethod.apply(this, methodArgs);
    };
    return descriptor;
  };
}

export function ReqQueryCheck(...args: string[]) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    descriptor.value = function (...methodArgs: any[]) {
      const req = methodArgs[0] as Request;
      if (!req.params) {
        throw new Error("Request params are required");
      }
      Log.debug(`ReqParamCheck: ${JSON.stringify(req.query)}`);
      const missingArgs = args.filter((arg) => !(arg in req.query));
      if (missingArgs.length > 0) {
        throw new Error(
          `Missing required URL parameters: ${missingArgs.join(", ")}`,
        );
      }
      return originalMethod.apply(this, methodArgs);
    };
    return descriptor;
  };
}
