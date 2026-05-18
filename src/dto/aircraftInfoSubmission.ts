import { prisma } from "../lib/prisma.js";

type SubmissionPayload = {
  reg?: string;
  msn?: string | null;
  ln?: string | null;
  airlineId?: number | null;
  airType?: string | null;
  air_type?: string | null;
  remark?: string | null;
};

function cleanText(value: unknown, max = 255) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length > max ? text.slice(0, max) : text;
}

function intOrNull(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default class AircraftInfoSubmission {
  static async create(userId: number, payload: SubmissionPayload) {
    const reg = cleanText(payload.reg, 63);
    if (!reg) {
      throw new Error("注册号不能为空");
    }
    const pendingRows = await prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM aircraft_info_submission
       WHERE create_user = ? AND status = 'WAITING' AND reg = ? AND is_delete = false
       LIMIT 1`,
      userId,
      reg,
    );
    if (pendingRows[0]) {
      throw new Error("该注册号已有待审核信息");
    }
    await prisma.$executeRawUnsafe(
      `INSERT INTO aircraft_info_submission
        (create_user, reg, msn, ln, airline_id, air_type, remark)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      userId,
      reg,
      cleanText(payload.msn, 20),
      cleanText(payload.ln, 20),
      intOrNull(payload.airlineId),
      cleanText(payload.airType || payload.air_type, 25),
      cleanText(payload.remark, 256),
    );
    const rows = await prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM aircraft_info_submission
       WHERE create_user = ? AND reg = ?
       ORDER BY id DESC LIMIT 1`,
      userId,
      reg,
    );
    return AircraftInfoSubmission.getById(rows[0].id);
  }

  static async list(status = "WAITING", userId?: number) {
    const values: unknown[] = [];
    const where = ["is_delete = false"];
    if (status !== "ALL") {
      where.push("status = ?");
      values.push(status);
    }
    if (userId) {
      where.push("create_user = ?");
      values.push(userId);
    }
    return prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM aircraft_info_submission
       WHERE ${where.join(" AND ")}
       ORDER BY created_at ASC, id ASC
       LIMIT 200`,
      ...values,
    );
  }

  static async getById(id: number) {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM aircraft_info_submission
       WHERE id = ? AND is_delete = false
       LIMIT 1`,
      id,
    );
    return rows[0] || null;
  }

  static async hasBlockingPendingForPhoto(photo: any) {
    const reg = cleanText(photo?.ac_reg, 63);
    if (!reg) return null;
    try {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, reg, msn, air_type, remark FROM aircraft_info_submission
         WHERE create_user = ?
           AND status = 'WAITING'
           AND reg = ?
           AND is_delete = false
         LIMIT 1`,
        photo.upload_user_id,
        reg,
      );
      return rows[0] || null;
    } catch (e) {
      if ((e as any)?.code === "P2010" && String((e as any)?.message || "").includes("aircraft_info_submission")) {
        return null;
      }
      throw e;
    }
  }

  static async review(id: number, reviewerId: number, status: "AVAILABLE" | "REJECT", message?: string) {
    const submission = await AircraftInfoSubmission.getById(id);
    if (!submission) return null;

    if (status === "AVAILABLE") {
      await AircraftInfoSubmission.upsertAircraft(submission);
    }

    await prisma.$executeRawUnsafe(
      `UPDATE aircraft_info_submission
       SET status = ?, review_message = ?, reviewer_id = ?, reviewed_at = NOW()
       WHERE id = ?`,
      status,
      cleanText(message, 256),
      reviewerId,
      id,
    );
    return AircraftInfoSubmission.getById(id);
  }

  private static async upsertAircraft(submission: any) {
    const rows = await prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM aircraft
       WHERE reg = ? AND (is_delete = false OR is_delete IS NULL)
       LIMIT 1`,
      submission.reg,
    );
    if (rows[0]) {
      await prisma.$executeRawUnsafe(
        `UPDATE aircraft
         SET msn = COALESCE(NULLIF(?, ''), msn),
             ln = COALESCE(NULLIF(?, ''), ln),
             airline_id = COALESCE(?, airline_id),
             air_type = COALESCE(NULLIF(?, ''), air_type),
             remark = COALESCE(NULLIF(?, ''), remark)
         WHERE id = ?`,
        submission.msn,
        submission.ln,
        submission.airline_id,
        submission.air_type,
        submission.remark,
        rows[0].id,
      );
      return;
    }
    await prisma.$executeRawUnsafe(
      `INSERT INTO aircraft (reg, msn, ln, airline_id, air_type, remark)
       VALUES (?, ?, ?, ?, ?, ?)`,
      submission.reg,
      submission.msn,
      submission.ln,
      submission.airline_id,
      submission.air_type,
      submission.remark,
    );
  }
}
