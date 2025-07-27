import { Prisma, PrismaClient } from "@prisma/client";
import Permission from "@/components/auth/permissions.js";

type PhotoInfo = Prisma.photoGetPayload<null>;

export default class UploadQueue {
  static prisma = new PrismaClient();

  static async getByUserId(userId: number) {
    return UploadQueue.prisma.full_photo_info.findMany({
      where: {
        upload_user_id: userId,
        status: "WAIT SCREEN",
      },
    });
  }

  static async getPhotosQueueByUserId(userId: number) {
    return UploadQueue.prisma
      .$queryRaw`WITH all_wait_screen_photos AS (SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS global_row_num FROM photo WHERE is_delete = 0 AND status = 'WAIT SCREEN') SELECT a.global_row_num AS position_in_queue, p.* FROM photo p JOIN all_wait_screen_photos a ON p.id = a.id WHERE p.upload_user_id = ${userId} AND p.is_delete = 0 AND p.status = 'WAIT SCREEN' ORDER BY p.id;` as unknown as PhotoInfo[];
  }

  static async getById(photoId: number) {
    return UploadQueue.prisma.full_photo_info.findUnique({
      where: { id: photoId },
    });
  }

  static async getTop(id: number, role: string) {
    if (Permission.isSeniorScreener(role)) {
      return UploadQueue.prisma.queue_photo.findFirst({
        where: {
          id: { gt: id },
          OR: [{ screener_1: null }, { screener_2: null }],
        },
      });
    } else {
      return UploadQueue.prisma.queue_photo.findFirst({
        where: {
          id: { gt: id },
          screener_1: null,
        },
      });
    }
  }

  static async update(queueId: number, data: any) {
    return UploadQueue.prisma.photo.update({
      where: { id: queueId },
      data: data,
    });
  }

  static async getQueue(type: "normal" | "priority" | "stuck" | "all") {
    if (type === "all") {
      return UploadQueue.prisma.queue_photo.findMany();
    }
    const query = {
      status: "WAIT SCREEN",
      queue: type.toLocaleUpperCase(),
    };
    if (type === "stuck") {
      query.status = "STUCK";
      delete query.queue;
    }
    console.log(query);
    return UploadQueue.prisma.queue_photo.findMany({ where: query });
  }

  static async recentScreenPhoto() {
    return UploadQueue.prisma.full_photo_info.findMany({
      where: {
        OR: [{ status: "ACCEPT" }, { status: "REJECT" }],
      },
      orderBy: { upload_time: "desc" },
      take: 50,
    });
  }

  static async rejectQueue(userId: number) {
    return this.prisma.full_photo_info.findMany({
      where: {
        upload_user_id: userId,
        status: "REJECT",
      },
      orderBy: { upload_time: "asc" },
      take: 10,
    });
  }
}
