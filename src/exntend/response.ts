import { ERROR_MSG } from "../types/http_code.js";

export function success(msg: any): void;
export function success(msg: string, data: any): void;
export function success(...args: any[]): void {
  if (args.length === 2) {
    const [msg, data] = args;
    return this.status(200).json({ msg: msg, data: data });
  } else if (args.length === 1) {
    const [msg] = args;
    return this.status(200).json({ msg: msg });
  }
}
export function fail(statusCode: number): void;
export function fail(statusCode: number, msg: string): void;
export function fail(statusCode: number, msg: string, data: any): void;
export function fail(...args: any[]): void {
  const [statusCode, msg, data] = args;
  if (args.length === 1) {
    return this.status(statusCode).json({ msg: ERROR_MSG[statusCode] });
  }
  if (args.length === 2) {
    return this.status(statusCode).json({ msg });
  }
  if (args.length === 3) {
    return this.status(statusCode).json({ msg, data });
  }
}
