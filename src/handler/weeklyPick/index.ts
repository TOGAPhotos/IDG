import type { Request, Response } from "express";

import WeeklyPick, { WeeklyPickInput } from "../../dto/weeklyPick.js";
import { prisma } from "../../lib/prisma.js";
import { HTTP_STATUS } from "../../types/http_code.js";
import { UrlCache } from "@/components/decorators/cache.js";

function parseWeek(v: unknown): Date | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(v + "T00:00:00.000Z");
  return isNaN(d.getTime()) ? null : d;
}

function formatWeek(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type AcceptPhoto = Awaited<ReturnType<typeof prisma.accept_photo.findMany>>[number];

async function buildResponse(week: Date, photoMap?: Map<number, AcceptPhoto>) {
  const picks = await WeeklyPick.getByWeek(week);
  if (picks.length === 0) return [];

  if (!photoMap) {
    const photos = await prisma.accept_photo.findMany({
      where: { id: { in: picks.map((p) => p.photo_id) } },
    });
    photoMap = new Map(photos.map((p) => [p.id, p]));
  }

  return picks
    .map((p) => {
      const photo = photoMap!.get(p.photo_id);
      if (!photo) return null;
      return {
        ...photo,
        photo_id: p.photo_id,
        comment: p.comment,
        author: p.author,
        order: p.order,
        week_start: formatWeek(p.week_start),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => a.order - b.order);
}

export default class WeeklyPickHandler {
  @UrlCache(3 * 60) // 3 minutes
  static async getList(req: Request, res: Response) {
    let week: Date | null;
    if (req.query["week"]) {
      week = parseWeek(req.query["week"]);
      if (!week) return res.fail(HTTP_STATUS.BAD_REQUEST, "week 格式应为 YYYY-MM-DD");
    } else {
      week = await WeeklyPick.getLatestWeek();
    }
    if (!week) return res.success("查询成功", []);

    const result = await buildResponse(week);
    res.success("查询成功", result);
  }

  static async getWeeks(_req: Request, res: Response) {
    const weeks = await WeeklyPick.listWeeks();
    res.success("查询成功", weeks.map(formatWeek));
  }

  static async replace(req: Request, res: Response) {
    const week = parseWeek(req.body?.week_start);
    if (!week) return res.fail(HTTP_STATUS.BAD_REQUEST, "week_start 格式应为 YYYY-MM-DD");

    const picksRaw = req.body?.picks;
    if (!Array.isArray(picksRaw)) return res.fail(HTTP_STATUS.BAD_REQUEST, "picks 必须是数组");

    const picks: WeeklyPickInput[] = [];
    for (const p of picksRaw) {
      const photoId = Number(p?.photo_id);
      const comment = typeof p?.comment === "string" ? p.comment : "";
      const author = typeof p?.author === "string" ? p.author.trim() : "";
      if (!Number.isInteger(photoId) || photoId <= 0) {
        return res.fail(HTTP_STATUS.BAD_REQUEST, "photo_id 非法");
      }
      if (!author) {
        return res.fail(HTTP_STATUS.BAD_REQUEST, "author 不能为空");
      }
      picks.push({ photo_id: photoId, comment, author });
    }

    // 同一周内 photo_id 不能重复（复合主键约束，提前拦截给友好提示）
    const ids = picks.map((p) => p.photo_id);
    if (new Set(ids).size !== ids.length) {
      return res.fail(HTTP_STATUS.BAD_REQUEST, "photo_id 不能重复");
    }

    let photoMap: Map<number, AcceptPhoto> | undefined;
    if (ids.length > 0) {
      const found = await prisma.accept_photo.findMany({
        where: { id: { in: ids } },
      });
      if (found.length !== ids.length) {
        return res.fail(HTTP_STATUS.BAD_REQUEST, "存在无效 photo_id");
      }
      photoMap = new Map(found.map((p) => [p.id, p]));
    }

    await WeeklyPick.replaceWeek(week, picks, req.token!.id);

    const result = await buildResponse(week, photoMap);
    res.success("保存成功", result);
  }
}
