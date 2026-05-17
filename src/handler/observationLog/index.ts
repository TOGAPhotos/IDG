import type { Request, Response } from "express";
import { HTTP_STATUS } from "../../types/http_code.js";
import ObservationLog from "../../dto/observationLog.js";
import Photo from "../../dto/photo.js";
import User from "../../dto/user.js";
import MessageQueueProducer from "../../service/messageQueue/producer.js";
import photoBucket from "../photo/cos.js";

function dateFromInput(value?: string | Date | null) {
  if (!value) return new Date();
  const date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? new Date() : date;
}

export default class ObservationLogHandler {
  private static imageProcessQueue = new MessageQueueProducer("imageProcess");

  static async create(req: Request, res: Response) {
    try {
      const log = await ObservationLog.create(req.token!.id, req.body);
      return res.success("创建成功", { log });
    } catch (e) {
      if (ObservationLog.isValidationError(e)) {
        return res.fail(HTTP_STATUS.BAD_REQUEST, (e as Error).message);
      }
      throw e;
    }
  }

  static async list(req: Request, res: Response) {
    const lastId = Number(req.query.lastId) || -1;
    const take = Number(req.query.take) || 20;
    const logs = await ObservationLog.list(req.token!.id, lastId, take);
    return res.success("查询成功", { logs });
  }

  static async get(req: Request, res: Response) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.fail(HTTP_STATUS.BAD_REQUEST, "日志ID无效");
    }
    const log = await ObservationLog.getVisible(id, req.token?.id ?? null);
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
    try {
      const log = await ObservationLog.update(id, req.token!.id, req.body);
      if (!log) {
        return res.fail(HTTP_STATUS.NOT_FOUND, "观察日志不存在");
      }
      return res.success("更新成功", { log });
    } catch (e) {
      if (ObservationLog.isValidationError(e)) {
        return res.fail(HTTP_STATUS.BAD_REQUEST, (e as Error).message);
      }
      throw e;
    }
  }

  static async delete(req: Request, res: Response) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.fail(HTTP_STATUS.BAD_REQUEST, "日志ID无效");
    }
    await ObservationLog.softDelete(id, req.token!.id);
    return res.success("删除成功");
  }

  static async search(req: Request, res: Response) {
    try {
      const logs = await ObservationLog.search(req.token!.id, req.body || {});
      return res.success("查询成功", { logs });
    } catch (e) {
      if (ObservationLog.isValidationError(e)) {
        return res.fail(HTTP_STATUS.BAD_REQUEST, (e as Error).message);
      }
      throw e;
    }
  }

  static async stats(req: Request, res: Response) {
    const stats = await ObservationLog.stats(req.token!.id, req.body || {});
    return res.success("查询成功", { stats });
  }

  static async imageUpload(req: Request, res: Response) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.fail(HTTP_STATUS.BAD_REQUEST, "日志ID无效");
    }
    const upload = await ObservationLog.prepareImageUpload(id, req.token!.id);
    if (!upload) {
      return res.fail(HTTP_STATUS.NOT_FOUND, "观察日志不存在");
    }
    return res.success("创建成功", {
      ...upload,
      uploadUrl: photoBucket.getUploadUrl(upload.rawKey),
    });
  }

  static async updateObjectStatus(req: Request, res: Response) {
    const logId = Number(req.query.log_id);
    const status = String(req.query.status || "");
    if (!Number.isFinite(logId)) {
      return res.fail(HTTP_STATUS.BAD_REQUEST, "日志ID无效");
    }
    const log = await ObservationLog.markImageUploading(logId, req.token!.id);
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
      const userId = req.token!.id;
      const log = await ObservationLog.getOwned(id, userId);
      if (!log) {
        return res.fail(HTTP_STATUS.NOT_FOUND, "观察日志不存在");
      }
      if (!log.image_key || log.image_status !== "COMPLETE") {
        throw new Error("观察日志图片尚未完成处理");
      }
      if (log.queued_photo_id) {
        return res.success("已加入审核队列", { photoId: log.queued_photo_id, reused: true });
      }

      const queue = ["PRIO", "PRIORITY"].includes(String(req.body?.queue || "NORMAL").toUpperCase())
        ? "PRIORITY"
        : "NORMAL";
      const userInfo = await User.getById(userId);
      if (userInfo.free_queue <= 0 || (queue === "PRIORITY" && userInfo.free_priority_queue! <= 0)) {
        throw new Error("队列已满");
      }

      const watermarkConfig = req.body?.watermark || { x: 20, y: 20, s: 0.2, a: 0.35 };
      const photo = await Photo.create({
        userId,
        uploadTime: new Date(),
        reg: log.ac_reg,
        msn: log.ac_msn,
        airline: log.airline_id,
        ac_type: log.ac_type,
        airport: log.airport_id,
        picType: log.pic_type,
        photoTime: dateFromInput(log.observed_at),
        remark: (log.note || "").slice(0, 256),
        queue,
        exif: log.exif,
        watermark: JSON.stringify(watermarkConfig),
      });

      try {
        const rawKey = `photos/${photo.id}.raw`;
        const sourceStream = photoBucket.streamDownload(log.image_key);
        await photoBucket.upload(rawKey, sourceStream as any);
        await Photo.update(photo.id, { storage_status: "UPLOAD" });
        await ObservationLogHandler.imageProcessQueue.send(JSON.stringify({
          task: "T1-copyrightOverlay",
          params: {
            photoId: photo.id,
            inputFile: rawKey,
            outputFile: `photos/${photo.id}.jpg`,
            username: userInfo.username,
            watermark: {
              x: Number(watermarkConfig.x || 20),
              y: Number(watermarkConfig.y || 20),
              scale: Number(watermarkConfig.s || watermarkConfig.scale || 0.2),
              alpha: Number(watermarkConfig.a || watermarkConfig.alpha || 0.35),
            },
            textConfig: {
              fontSize: 16,
              fontFamily: "Source Han Sans CN",
            },
          },
        }));
        await Promise.all([
          User.updateById(userId, {
            free_queue: { decrement: 1 },
            free_priority_queue: { decrement: queue === "PRIORITY" ? 1 : 0 },
          }),
          ObservationLog.linkQueuedPhoto(id, userId, photo.id),
        ]);
      } catch (e) {
        await Photo.deleteById(photo.id);
        throw e;
      }

      const result = { photoId: photo.id, reused: false };
      return res.success("已加入审核队列", result);
    } catch (e) {
      return res.fail(HTTP_STATUS.BAD_REQUEST, (e as Error).message);
    }
  }
}
