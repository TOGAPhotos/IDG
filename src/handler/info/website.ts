import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { UrlCache } from "../../components/decorators/cache.js";
import Photo from "../../dto/photo.js";

export default class WebsiteHandler {
  private static prisma = new PrismaClient();

  private static async getPhotoList() {
    return WebsiteHandler.prisma.accept_photo.findMany({
      select:Photo.searchSelectConfig,
      take: 40,
      orderBy: { upload_time: "desc" },
    });
  }

  private static async getRandomPhotos() {
    return WebsiteHandler.prisma.$queryRawUnsafe(
      `SELECT ${Object.keys(Photo.searchSelectConfig).join(',')} FROM accept_photo ORDER BY RAND() LIMIT 8`,
    );
  }

  private static async getBasicInfo() {
    return {
      userNum: await WebsiteHandler.prisma.user.count({
        where: { is_deleted: false },
      }),
      uploadQueueLen: await WebsiteHandler.prisma.queue_photo.count(),
      photoNum: await WebsiteHandler.prisma.accept_photo.count(),
    };
  }

  @UrlCache(180)
  static async get(req: Request, res: Response) {
    const type = req.query?.type || "";
    let data = {};
    switch (type) {
      case "photos":
        data = await WebsiteHandler.getPhotoList();
        break;
      case "random":
        data = await WebsiteHandler.getRandomPhotos();
        break;
      case "statistics":
        data = await WebsiteHandler.getBasicInfo();
        break;
      default:
        data = await Promise.all([
          WebsiteHandler.getPhotoList(),
          WebsiteHandler.getBasicInfo(),
          WebsiteHandler.getRandomPhotos(),
        ]);
        break;
    }
    res.success("网站正常", data);
  }
}
