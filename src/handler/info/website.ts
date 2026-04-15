import { Request, Response } from "express";
import { Prisma, prisma } from "../../lib/prisma.js";
import { UrlCache } from "../../components/decorators/cache.js";
import Photo from "../../dto/photo.js";
import { PrismaPromise } from "@/generated/prisma/internal/prismaNamespaceBrowser.js";

export default class WebsiteHandler {

  private static async getPhotoList() {
    return prisma.accept_photo.findMany({
      select: Photo.searchSelectConfig,
      take: 40,
      orderBy: { upload_time: "desc" },
    });
  }

  private static async getRandomPhotos() {
    return prisma.$queryRawUnsafe(
      `SELECT ${Object.keys(Photo.searchSelectConfig).join(',')} FROM accept_photo ORDER BY RAND() LIMIT 8`,
    ) as PrismaPromise<Prisma.accept_photoGetPayload<{ select: typeof Photo.searchSelectConfig }>[]>;
  }

  private static async getBasicInfo() {
    return {
      userNum: await prisma.user.count({
        where: { is_deleted: false },
      }),
      uploadQueueLen: await prisma.queue_photo.count(),
      photoNum: await prisma.accept_photo.count(),
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
