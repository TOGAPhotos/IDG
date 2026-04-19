import type { Request, Response } from "express";

import Permission from "../../components/auth/permissions.js";
import WeeklyPick from "../../dto/weeklyPick.js";
import { prisma } from "../../lib/prisma.js";
import { LockAcquireError, withLock } from "../../service/redis/lock.js";
import { HTTP_STATUS } from "../../types/http_code.js";
import { UrlCache, invalidateUrlCache } from "../../components/decorators/cache.js";

const WEEKLY_PICKS_CACHE_GROUP = "weekly-picks";

function parseWeek(v: unknown): Date | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(v + "T00:00:00.000Z");
  if (isNaN(d.getTime())) return null;
  return formatWeek(d) === v ? d : null;
}

function formatWeek(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parsePhotoId(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
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
        author_id: p.author_id,
        order: p.order,
        week_start: formatWeek(p.week_start),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => a.order - b.order);
}

export default class WeeklyPickHandler {
  @UrlCache(3 * 60, WEEKLY_PICKS_CACHE_GROUP)
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

  @UrlCache(3 * 60, WEEKLY_PICKS_CACHE_GROUP)
  static async getWeeks(_req: Request, res: Response) {
    const weeks = await WeeklyPick.listWeeks();
    res.success("查询成功", weeks.map(formatWeek));
  }

  static async upsertItem(req: Request, res: Response) {
    const week = parseWeek(req.params["week"]);
    if (!week) return res.fail(HTTP_STATUS.BAD_REQUEST, "week 格式应为 YYYY-MM-DD");

    const photoId = parsePhotoId(req.params["photoId"]);
    if (!photoId) return res.fail(HTTP_STATUS.BAD_REQUEST, "photo_id 非法");

    const comment = typeof req.body?.comment === "string" ? req.body.comment : "";
    const author = typeof req.body?.author === "string" ? req.body.author.trim() : "";
    if (!author) return res.fail(HTTP_STATUS.BAD_REQUEST, "author 不能为空");
    if (author.length > 50) return res.fail(HTTP_STATUS.BAD_REQUEST, "author 长度不能超过 50");

    const photo = await prisma.accept_photo.findUnique({ where: { id: photoId } });
    if (!photo) return res.fail(HTTP_STATUS.BAD_REQUEST, "photo 不存在");

    const isAdmin = Permission.isAdmin(req.role ?? "");
    const userId = req.token!.id;
    const lockKey = `wp:week:${formatWeek(week)}`;

    let forbidden = false;
    try {
      await withLock([lockKey], async () => {
        const existing = await WeeklyPick.getOne(week, photoId);
        if (existing) {
          if (!isAdmin && existing.author_id !== userId) {
            forbidden = true;
            return;
          }
          await WeeklyPick.updateOne(week, photoId, { comment, author });
        } else {
          const maxOrder = await WeeklyPick.getMaxOrder(week);
          await WeeklyPick.createOne(week, photoId, {
            comment,
            author,
            author_id: userId,
            order: maxOrder + 1,
          });
        }
      });
    } catch (e) {
      if (e instanceof LockAcquireError) {
        return res.fail(HTTP_STATUS.CONFLICT, "该 pick 正在被编辑,请稍后重试");
      }
      throw e;
    }
    if (forbidden) {
      return res.fail(HTTP_STATUS.FORBIDDEN, "仅原作者或管理员可编辑该 pick");
    }

    invalidateUrlCache(WEEKLY_PICKS_CACHE_GROUP);

    const saved = await WeeklyPick.getOne(week, photoId);
    res.success("保存成功", saved && {
      ...photo,
      photo_id: saved.photo_id,
      comment: saved.comment,
      author: saved.author,
      author_id: saved.author_id,
      order: saved.order,
      week_start: formatWeek(saved.week_start),
    });
  }

  static async deleteItem(req: Request, res: Response) {
    const week = parseWeek(req.params["week"]);
    if (!week) return res.fail(HTTP_STATUS.BAD_REQUEST, "week 格式应为 YYYY-MM-DD");

    const photoId = parsePhotoId(req.params["photoId"]);
    if (!photoId) return res.fail(HTTP_STATUS.BAD_REQUEST, "photo_id 非法");

    const isAdmin = Permission.isAdmin(req.role ?? "");
    const userId = req.token!.id;
    const lockKey = `wp:week:${formatWeek(week)}`;

    let notFound = false;
    let forbidden = false;
    try {
      await withLock([lockKey], async () => {
        const existing = await WeeklyPick.getOne(week, photoId);
        if (!existing) {
          notFound = true;
          return;
        }
        if (!isAdmin && existing.author_id !== userId) {
          forbidden = true;
          return;
        }
        await WeeklyPick.deleteOne(week, photoId);
      });
    } catch (e) {
      if (e instanceof LockAcquireError) {
        return res.fail(HTTP_STATUS.CONFLICT, "该 pick 正在被编辑,请稍后重试");
      }
      throw e;
    }
    if (notFound) return res.fail(HTTP_STATUS.NOT_FOUND, "pick 不存在");
    if (forbidden) return res.fail(HTTP_STATUS.FORBIDDEN, "仅原作者或管理员可删除该 pick");

    invalidateUrlCache(WEEKLY_PICKS_CACHE_GROUP);
    res.success("删除成功");
  }

  static async reorder(req: Request, res: Response) {
    const week = parseWeek(req.params["week"]);
    if (!week) return res.fail(HTTP_STATUS.BAD_REQUEST, "week 格式应为 YYYY-MM-DD");

    const orderingRaw = req.body?.ordering;
    if (!Array.isArray(orderingRaw)) {
      return res.fail(HTTP_STATUS.BAD_REQUEST, "ordering 必须是数组");
    }

    const ordering: { photo_id: number; order: number }[] = [];
    for (const o of orderingRaw) {
      const photoId = parsePhotoId(o?.photo_id);
      const order = Number(o?.order);
      if (!photoId) return res.fail(HTTP_STATUS.BAD_REQUEST, "photo_id 非法");
      if (!Number.isInteger(order) || order < 0) {
        return res.fail(HTTP_STATUS.BAD_REQUEST, "order 非法");
      }
      ordering.push({ photo_id: photoId, order });
    }

    const ids = ordering.map((o) => o.photo_id);
    if (new Set(ids).size !== ids.length) {
      return res.fail(HTTP_STATUS.BAD_REQUEST, "photo_id 不能重复");
    }

    const lockKey = `wp:week:${formatWeek(week)}`;

    let invalidIds = false;
    try {
      await withLock([lockKey], async () => {
        const existing = await WeeklyPick.getByWeek(week);
        const existingIds = new Set(existing.map((e) => e.photo_id));
        if (ids.some((id) => !existingIds.has(id))) {
          invalidIds = true;
          return;
        }
        await WeeklyPick.updateOrders(week, ordering);
      });
    } catch (e) {
      if (e instanceof LockAcquireError) {
        return res.fail(HTTP_STATUS.CONFLICT, "本周 picks 正在被调整,请稍后重试");
      }
      throw e;
    }
    if (invalidIds) {
      return res.fail(HTTP_STATUS.BAD_REQUEST, "ordering 中存在本周不存在的 photo_id");
    }

    invalidateUrlCache(WEEKLY_PICKS_CACHE_GROUP);
    const result = await buildResponse(week);
    res.success("保存成功", result);
  }
}
