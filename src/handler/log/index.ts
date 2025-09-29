import { Request, Response } from "express";
import { addLogClient } from "../../components/logStream.js";

export default class LogStreamHandler {
  public static async stream(req: Request, res: Response) {

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    // Disable nginx proxy buffering if present
    res.setHeader("X-Accel-Buffering", "no");

    addLogClient(res);
  }
}

