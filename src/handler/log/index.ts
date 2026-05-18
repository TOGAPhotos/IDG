import { Request, Response } from "express";
import { addLogClient } from "../../components/logStream.js";
import Log from "../../components/loger.js";

export default class LogStreamHandler {
  public static async stream(req: Request, res: Response) {

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    // Disable nginx proxy buffering if present
    res.setHeader("X-Accel-Buffering", "no");

    Log.info(
      `Log stream connected via Cloudflare Access email:${req.cfAccess?.email || "UNKNOWN"} sub:${req.cfAccess?.sub || "UNKNOWN"}`,
    );
    addLogClient(res);
  }
}
