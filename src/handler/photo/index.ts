import type { Request, Response } from "express";
import Log from "../../components/loger.js";

import User from "../../dto/user.js";
import Photo from "../../dto/photo.js";
import Permission from "../../components/auth/permissions.js";

import { HTTP_STATUS } from "../../types/http_code.js";
import photoBucket from "./cos.js";
import QueueHandler from "../queue/index.js";
import MessageQueueProducer from "../../service/messageQueue/producer.js";
import { PhotoCopyrightOverlayConfig } from "../../service/imageProcesser/index.js";
import { EventBus } from "../../components/eventBus/indes.js";

export default class PhotoHandler {
  private static readonly photoBucket = photoBucket;
  private static readonly queueType = {
    PRIORITY: "PRIO",
    NORMAL: "NORM",
  };
  private static imageProcessQueue = new MessageQueueProducer("imageProcess");
  private static eventBus = new EventBus();

  static async get(req: Request, res: Response) {
    const id = Number(req.params["id"]);
    const photoInfo = await Photo.getAcceptById(id);

    if (photoInfo === null) {
      return res.fail(HTTP_STATUS.NOT_FOUND, "图片不存在");
    }

    if (
      photoInfo.storage_status !== "COMPLETE" &&
      req.token?.id !== photoInfo.upload_user_id
    ) {
      if (!req.token?.id) {
        return res.fail(HTTP_STATUS.SERVER_ERROR, "请先登录");
      }
      const u = await User.getById(req.token.id);
      if (!Permission.isStaff(u.role)) {
        return res.fail(HTTP_STATUS.SERVER_ERROR, "图片未完成处理");
      }
    }

    res.success("获取成功", photoInfo);
  }

  static async getList(req: Request, res: Response) {
    const lastId = Number(req.query["lastId"]) || -1;
    const type = req.query["type"] as string | null || "all";
    const take = Number(req.query["take"]) || 20;
    let list;
    if(type === "ScreenerChoice"){
      list = await Photo.getScreenerChoicePhotoList(lastId, take)
    }else{
      list = await Photo.getAcceptPhotoList(lastId, take);
    }
    res.success("查询成功", list);
  }

  static async search(req: Request, res: Response) {
    const type = req.query["type"] as string;
    const keyword = req.query["keyword"] as string;
    let lastId = Number(req.query["lastId"]) || -1;
    const num = Number(req.query["num"]) || 20;

    let result;
    switch (type) {
      case "blurry":
        result = await Photo.blurrySearch(keyword, lastId, num);
        break;
      case "reg":
        result = await Photo.searchByRegKeyword(keyword, lastId, num);
        break;
      case "airline":
        result = await Photo.searchByAirlineKeyword(keyword, lastId, num);
        break;
      case "airtype":
        result = await Photo.searchByAirtypeKeyword(keyword, lastId, num);
        break;
      case "airport":
        result = await Photo.searchByAirportKeyword(keyword, lastId, num);
        break;
      case "user":
        result = await Photo.searchByUserKeyword(keyword, lastId, num);
        break;
      default:
        throw new Error("Search Type");
    }
    res.success("查询成功", result);
  }

  static async upload(req: Request, res: Response) {
    const userId = req.token.id;
    const userInfo = await User.getById(userId);

    if (
      (req["queue"] === PhotoHandler.queueType.PRIORITY &&
        userInfo?.free_priority_queue <= 0) ||
      userInfo?.free_queue <= 0
    ) {
      return res.fail(HTTP_STATUS.FORBIDDEN, "队列已满");
    }
    let photoInfo;
    try {
      photoInfo = await Photo.create({
        userId: userId,
        uploadTime: req.body["uploadTime"],
        reg: req.body["reg"],
        msn: req.body["msn"],
        airline: req.body["airline"],
        ac_type: req.body["ac_type"],
        airport: req.body["airport"],
        picType: req.body["picType"],
        photoTime: new Date(req.body["photoTime"]),
        remark: req.body["remark"],
        queue:
          req["queue"] === PhotoHandler.queueType.PRIORITY
            ? "PRIORITY"
            : "NORMAL",
        exif: req.body["exif"],
        watermark: req.body["watermark"],
      });
    } catch (e) {
      Log.error(e);
      return res.fail(HTTP_STATUS.SERVER_ERROR, "数据库错误");
    }
    try {
      const uploadUrl = PhotoHandler.photoBucket.getUploadUrl(
        "photos/" + photoInfo["id"] + ".raw",
      );
      res.success("创建成功", {
        uploadUrl,
        photoId: photoInfo["id"],
      });
      await User.updateById(userId, {
        free_queue: { decrement: 1 },
        free_priority_queue: {
          decrement: req["queue"] === PhotoHandler.queueType.PRIORITY ? 1 : 0,
        },
      });
    } catch {
      await Photo.deleteById(photoInfo["id"]);
      return res.fail(HTTP_STATUS.SERVER_ERROR, "上传失败/COS错误");
    }
  }

  static async recall(req: Request, res: Response) {
    const userId = req.token.id;
    const photoId = Number(req.params["id"]);

    const photoInfo = await Photo.getById(photoId);

    Log.info(`Photo recall request user:${userId} photo:${photoId}`);
    if (photoInfo === null) {
      return res.fail(HTTP_STATUS.NOT_FOUND, "已删除");
    }
    if(userId !== photoInfo.upload_user_id){
      Log.warn(`Photo recall forbidden user:${userId} photo:${photoId}`);
      return res.fail(HTTP_STATUS.FORBIDDEN, "您没有权限撤回图片");
    }
    await Promise.allSettled([
      Photo.deleteById(photoId),
      User.updateById(userId,{
        free_queue: { increment: 1 },
        free_priority_queue: {
          increment: photoInfo.queue === "PRIORITY" ? 1 : 0,
        },
      })
    ])
    Log.info(`Photo recall success user:${userId} photo:${photoId}`);
  }

  static async delete(req: Request, res: Response) {
    const userId = req.token.id;
    const photoId = Number(req.params["id"]);

    const [userInfo, photoInfo] = await Promise.all([
      User.getById(userId),
      Photo.getById(photoId),
    ]);

    Log.info(`Photo delete attempt user:${userId} username:${userInfo["username"]} photo:${photoId}`);

    if (photoInfo === null) {
      return res.fail(HTTP_STATUS.NOT_FOUND, "已删除");
    }

    const screener = await QueueHandler.uploadQueueCache.get(photoId);
    if (screener !== null && Number(screener) !== req.token.id) {
      Log.warn(`Photo delete conflict user:${userId} photo:${photoId} screener:${screener}`);
      return res.fail(HTTP_STATUS.CONFLICT, "图片正在审核中");
    }

    if (
      !(
        Permission.checkUserPermission(userInfo.role, Permission.screener1) ||
        userId === photoInfo.upload_user_id
      )
    ) {
      Log.warn(`Photo delete forbidden user:${userId} photo:${photoId}`);
      return res.fail(HTTP_STATUS.FORBIDDEN, "您没有权限删除图片");
    }

    try {
      await Promise.all([
        Photo.deleteById(photoId),
        //@ts-ignore
        PhotoHandler.photoBucket.deleteObject({
          Bucket: PhotoHandler.photoBucket.bucket,
          Region: PhotoHandler.photoBucket.region,
          Key: `photos/${photoId}.jpg`,
        }),
        //@ts-ignore
        PhotoHandler.photoBucket.deleteObject({
          Bucket: PhotoHandler.photoBucket.bucket,
          Region: PhotoHandler.photoBucket.region,
          Key: `photos/${photoId}.raw`,
        }),
      ]);
      PhotoHandler.eventBus.publish("photo:delete", { photoId });
      Log.info(`Photo delete success user:${userId} photo:${photoId}`);
    } catch (e) {
      await Photo.update(photoId, { is_delete: false });
      Log.error(`Photo delete failed user:${userId} photo:${photoId} err:${(e as Error).message}`);
      return res.fail(HTTP_STATUS.SERVER_ERROR, "删除失败");
    }

    if (photoInfo.status === "WAIT SCREEN") {
      let data = { free_queue: { increment: 1 } };
      if (photoInfo.queue === "PRIORITY") {
        data["free_priority_queue"] = { increment: 1 };
      }
      await User.updateById(userId, data);
    }
    res.success("删除成功");
  }

  static async update(req: Request, res: Response) {
    let photoId = Number(req.params["id"]);

    const [userInfo, photoInfo] = await Promise.all([
      User.getById(req.token.id),
      Photo.getById(photoId),
    ]);

    if (!photoInfo) {
      return res.fail(HTTP_STATUS.NOT_FOUND, "已删除");
    }

    if (
      !(
        Permission.checkUserPermission(userInfo.role, "DATABASE") ||
        req.token.id !== photoInfo["uploader"]
      )
    ) {
      return res.fail(HTTP_STATUS.FORBIDDEN);
    }

    const screener = await QueueHandler.uploadQueueCache.get(photoId);
    if (screener !== null && Number(screener) !== req.token.id) {
      return res.fail(HTTP_STATUS.CONFLICT, "图片正在审核中");
    }

    await Photo.update(photoId, req.body);
    return res.success("更新成功");
  }

  static async updateObjectStatus(req: Request, res: Response) {
    const { status, photo_id: photoId } = req.query as {
      status: string;
      photo_id: string | null;
    };
    if (!photoId || isNaN(Number(photoId))) {
      return res.fail(HTTP_STATUS.BAD_REQUEST, "参数错误");
    }
    let photoInfo, userInfo;
    try {
      [photoInfo, userInfo] = await Promise.all([
        Photo.update(Number(photoId), { storage_status: "UPLOAD" }),
        User.getById(req.token.id),
      ]);
    } catch (e) {
      Log.error(`Photo status update failed photo:${photoId} err:${(e as Error).message}`);
      return res.fail(HTTP_STATUS.NOT_FOUND, "图片不存在");
    }

    if (status === "available") {
      Log.debug(`Photo imageProcess enqueue photo:${photoId}`);
      const watermark = JSON.parse(<string>photoInfo.watermark);
      await PhotoHandler.imageProcessQueue.send(
        JSON.stringify({
          task: "T1-copyrightOverlay",
          params: new PhotoCopyrightOverlayConfig({
            photoId: photoInfo.id,
            username: userInfo.username,
            watermarkConfig: {
              x: watermark["x"] as number,
              y: watermark["y"] as number,
              scale: watermark["s"] as number,
              alpha: watermark["a"] as number,
            },
          }),
        }),
      );
    }
    Log.info(`Photo object status updated photo:${photoId} status:${status}`);
    res.success("更新成功");
  }
}
