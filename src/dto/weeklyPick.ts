import { prisma } from "../lib/prisma.js";

export interface WeeklyPickInput {
  photo_id: number;
  comment: string;
  author: string;
}

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

  static async replaceWeek(
    week: Date,
    picks: WeeklyPickInput[],
    authorId: number,
  ) {
    const del = prisma.weekly_pick.deleteMany({ where: { week_start: week } });
    if (picks.length === 0) return prisma.$transaction([del]);
    return prisma.$transaction([
      del,
      prisma.weekly_pick.createMany({
        data: picks.map((p, i) => ({
          week_start: week,
          photo_id: p.photo_id,
          order: i,
          comment: p.comment,
          author: p.author,
          author_id: authorId,
        })),
      }),
    ]);
  }
}
