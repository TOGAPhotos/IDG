import { prisma } from "../lib/prisma.js";

export default class WeeklyPick {
  static async getLatestWeek(): Promise<Date | null> {
    const row = await prisma.weekly_pick.findFirst({
      orderBy: { week_start: "desc" },
      select: { week_start: true },
    });
    return row?.week_start ?? null;
  }

  static async getByWeek(week: Date) {
    return prisma.weekly_pick.findMany({
      where: { week_start: week },
      orderBy: { order: "asc" },
    });
  }

  static async listWeeks(): Promise<Date[]> {
    const rows = await prisma.weekly_pick.findMany({
      distinct: ["week_start"],
      select: { week_start: true },
      orderBy: { week_start: "desc" },
    });
    return rows.map((r) => r.week_start);
  }

  static async getOne(week: Date, photoId: number) {
    return prisma.weekly_pick.findUnique({
      where: { week_start_photo_id: { week_start: week, photo_id: photoId } },
    });
  }

  static async createOne(
    week: Date,
    photoId: number,
    data: { comment: string; author: string; author_id: number; order: number },
  ) {
    return prisma.weekly_pick.create({
      data: {
        week_start: week,
        photo_id: photoId,
        ...data,
      },
    });
  }

  static async updateOne(
    week: Date,
    photoId: number,
    data: { comment?: string; author?: string },
  ) {
    return prisma.weekly_pick.update({
      where: { week_start_photo_id: { week_start: week, photo_id: photoId } },
      data,
    });
  }

  static async deleteOne(week: Date, photoId: number) {
    return prisma.weekly_pick.delete({
      where: { week_start_photo_id: { week_start: week, photo_id: photoId } },
    });
  }

  static async getMaxOrder(week: Date): Promise<number> {
    const agg = await prisma.weekly_pick.aggregate({
      where: { week_start: week },
      _max: { order: true },
    });
    return agg._max.order ?? -1;
  }

  static async updateOrders(
    week: Date,
    ordering: { photo_id: number; order: number }[],
  ) {
    return prisma.$transaction(
      ordering.map((o) =>
        prisma.weekly_pick.update({
          where: {
            week_start_photo_id: { week_start: week, photo_id: o.photo_id },
          },
          data: { order: o.order },
        }),
      ),
    );
  }
}
