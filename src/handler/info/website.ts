import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { UrlCache } from "../../components/decorators/cache.js";

export default class WebsiteHandler {
  private static prisma = new PrismaClient();

  private static async getPhotoList() {
    return WebsiteHandler.prisma.accept_photo.findMany({
      select:{
        id: true,
        username: true,
        ac_type: true,
        ac_reg: true,
        airline_cn: true,
        airline_en: true,
        airline_iata_code:true,
        airline_icao_code:true,
        airport_cn: true,
        airport_en: true,
      },
      take: 40,
      orderBy: { upload_time: "desc" },
    });
  }

  private static async getRandomPhotos() {
    return WebsiteHandler.prisma.$queryRawUnsafe(
      `SELECT * FROM accept_photo ORDER BY RAND() LIMIT 8`,
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
