import { prisma, Prisma } from "../lib/prisma.js";
import Permission from "../components/auth/permissions.js";

type PhotoInfo = Prisma.photoGetPayload<{}>;

export default class UploadQueue {

  static async getByUserId(userId: number) {
    return prisma.full_photo_info.findMany({
      where: {
        upload_user_id: userId,
        status: "WAIT SCREEN",
      },
    });
  }

  static async getPhotosQueueByUserId(userId: number) {
    return prisma
      .$queryRaw`WITH all_wait_screen_photos AS
                       (SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS global_row_num
                        FROM queue_photo)
                SELECT p.id, p.username, p.ac_msn, ac_reg, p.airline_cn, p.airline_en,
                       p.airport_cn, p.airport_en, p.airport_iata_code,p.airport_icao_code, 
                       p.ac_type, p.pic_type, p.photo_time, global_row_num
                FROM queue_photo p
                       JOIN all_wait_screen_photos a ON p.id = a.id
                WHERE p.upload_user_id = ${userId};
      ` as unknown as PhotoInfo[];
  }

  static async getById(photoId: number) {
    return prisma.full_photo_info.findUnique({
      where: { id: photoId },
    });
  }

  static async getTop(id: number, role: string) {
    if (Permission.isSeniorScreener(role)) {
      return prisma.queue_photo.findFirst({
        where: {
          id: { gt: id },
          status: { not: "STUCK" },
          OR: [{ screener_1: null }, { screener_2: null }],
        },
      });
    } else {
      return prisma.queue_photo.findFirst({
        where: {
          id: { gt: id },
          screener_1: null,
        },
      });
    }
  }

  static async update(queueId: number, data: Prisma.photoUpdateInput) {
    return prisma.photo.update({
      where: { id: queueId },
      data: data,
    });
  }

  static async getQueue(type: "normal" | "priority" | "stuck" | "all", userId: number) {
    if (type === "all") {
      return prisma.queue_photo.findMany();
    }
    const where: Prisma.queue_photoWhereInput =
      type === "stuck"
        ? { status: "STUCK" }
        : { status: "WAIT SCREEN", queue: type.toLocaleUpperCase() };
    return prisma.queue_photo.findMany({ where });
  }

  static async recentScreenPhoto() {
    return prisma.full_photo_info.findMany({
      where: {
        OR: [{ status: "ACCEPT" }, { status: "REJECT" }],
      },
      orderBy: { upload_time: "desc" },
      take: 50,
    });
  }

  static async rejectQueue(userId: number) {
    return prisma.full_photo_info.findMany({
      where: {
        upload_user_id: userId,
        status: "REJECT",
        screen_finished_time: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        }
      },
      orderBy: { id: "desc" },
      take: 10,
    });
  }

  static async recallScreenedPhoto(
    photoId: number
  ) {

    await Promise.allSettled([
      UploadQueue.update(
        photoId,
        {
          screener_2: null,
          status: 'WAIT SCREEN',
          screen_finished_time: null,
          notify: false,
        }
      ),
      // User.updateById(
      //   data.screenerId,
      //   {
      //     total_photo: { increment: 0 },
      //   }
      // ),
    ]);
  }
}
