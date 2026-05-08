import type { Request, Response } from "express";
import { HTTP_STATUS } from "../../types/http_code.js";
import ObservationLog from "../../dto/observationLog.js";
import MessageQueueProducer from "../../service/messageQueue/producer.js";

export default class ObservationLogHandler {
  private static imageProcessQueue = new MessageQueueProducer("imageProcess");

  static async create(req: Request, res: Response) {
    const log = await ObservationLog.create(req.token.id, req.body);
    return res.success("创建成功", { log });
  }

  static async list(req: Request, res: Response) {
    const lastId = Number(req.query.lastId) || -1;
    const take = Number(req.query.take) || 20;
    const logs = await ObservationLog.list(req.token.id, lastId, take);
    return res.success("查询成功", { logs });
  }

  static async get(req: Request, res: Response) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.fail(HTTP_STATUS.BAD_REQUEST, "日志ID无效");
    }
    const log = await ObservationLog.getVisible(id, req.token?.id);
    if (!log) {
      return res.fail(HTTP_STATUS.NOT_FOUND, "观察日志不存在");
    }
    return res.success("查询成功", { log });
  }

  static async update(req: Request, res: Response) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.fail(HTTP_STATUS.BAD_REQUEST, "日志ID无效");
    }
    const log = await ObservationLog.update(id, req.token.id, req.body);
    if (!log) {
      return res.fail(HTTP_STATUS.NOT_FOUND, "观察日志不存在");
    }
    return res.success("更新成功", { log });
  }

  static async delete(req: Request, res: Response) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.fail(HTTP_STATUS.BAD_REQUEST, "日志ID无效");
    }
    await ObservationLog.softDelete(id, req.token.id);
    return res.success("删除成功");
  }

  static async search(req: Request, res: Response) {
    const logs = await ObservationLog.search(req.token.id, req.body || {});
    return res.success("查询成功", { logs });
  }

  static async stats(req: Request, res: Response) {
    const stats = await ObservationLog.stats(req.token.id, req.body || {});
    return res.success("查询成功", { stats });
  }

  static async imageUpload(req: Request, res: Response) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.fail(HTTP_STATUS.BAD_REQUEST, "日志ID无效");
    }
    const upload = await ObservationLog.prepareImageUpload(id, req.token.id);
    if (!upload) {
      return res.fail(HTTP_STATUS.NOT_FOUND, "观察日志不存在");
    }
    return res.success("创建成功", upload);
  }

  static async updateObjectStatus(req: Request, res: Response) {
    const logId = Number(req.query.log_id);
    const status = String(req.query.status || "");
    if (!Number.isFinite(logId)) {
      return res.fail(HTTP_STATUS.BAD_REQUEST, "日志ID无效");
    }
    const log = await ObservationLog.markImageUploading(logId, req.token.id);
    if (!log) {
      return res.fail(HTTP_STATUS.NOT_FOUND, "观察日志不存在");
    }
    if (status === "available") {
      await ObservationLogHandler.imageProcessQueue.send(JSON.stringify({
        task: "T2-observationLogImageNormalize",
        params: {
          logId,
          inputFile: `observation-logs/${logId}.raw`,
          outputFile: `observation-logs/${logId}.jpg`,
        },
      }));
    }
    return res.success("更新成功");
  }

  static async queueUpload(req: Request, res: Response) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.fail(HTTP_STATUS.BAD_REQUEST, "日志ID无效");
    }
    try {
      const result = await ObservationLog.queueUploadFromLog(
        id,
        req.token.id,
        req.body?.queue,
        req.body?.watermark,
      );
      if (!result) {
        return res.fail(HTTP_STATUS.NOT_FOUND, "观察日志不存在");
      }
      return res.success("已加入审核队列", result);
    } catch (e) {
      return res.fail(HTTP_STATUS.BAD_REQUEST, (e as Error).message);
    }
  }
}
