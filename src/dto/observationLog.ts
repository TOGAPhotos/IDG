import { prisma } from "../lib/prisma.js";
import Photo from "./photo.js";
import User from "./user.js";
import photoBucket from "../handler/photo/cos.js";
import MessageQueueProducer from "../service/messageQueue/producer.js";

type FieldType = "TEXT" | "NUMBER" | "DATE" | "BOOLEAN" | "SELECT";
type Visibility = "PRIVATE" | "PUBLIC";
type LogSource = "MANUAL" | "QUICK_UPLOAD" | "ACCEPTED_PHOTO";

type ObservationLogPayload = {
  visibility?: string;
  source?: string;
  observedAt?: string | Date;
  airportId?: number | null;
  airlineId?: number | null;
  acReg?: string | null;
  acMsn?: string | null;
  acType?: string | null;
  picType?: string | null;
  title?: string | null;
  locationText?: string | null;
  note?: string | null;
  exif?: unknown;
  pendingInfo?: unknown;
  metadata?: unknown;
  tags?: string[];
  fields?: FieldValuePayload[];
};

type FieldPayload = {
  fieldKey?: string;
  label?: string;
  valueType?: string;
  type?: string;
  options?: unknown;
  unit?: string | null;
};

type FieldValuePayload = {
  fieldId?: number;
  id?: number;
  value?: unknown;
  textValue?: string | null;
  numberValue?: number | string | null;
  dateValue?: string | Date | null;
  boolValue?: boolean | number | string | null;
  selectValue?: string | null;
};

type ObservationLogRow = Record<string, any>;

const VALID_VISIBILITIES = new Set(["PRIVATE", "PUBLIC"]);
const VALID_SOURCES = new Set(["MANUAL", "QUICK_UPLOAD", "ACCEPTED_PHOTO"]);
const VALID_FIELD_TYPES = new Set(["TEXT", "NUMBER", "DATE", "BOOLEAN", "SELECT"]);
const imageProcessQueue = new MessageQueueProducer("imageProcess");

function parseJson(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function jsonValue(value: unknown) {
  if (value === undefined) return null;
  return JSON.stringify(value);
}

function normalizeVisibility(value?: string): Visibility {
  const visibility = String(value || "PRIVATE").toUpperCase();
  return VALID_VISIBILITIES.has(visibility) ? visibility as Visibility : "PRIVATE";
}

function normalizeSource(value?: string): LogSource {
  const source = String(value || "MANUAL").toUpperCase();
  return VALID_SOURCES.has(source) ? source as LogSource : "MANUAL";
}

function normalizeFieldType(value?: string): FieldType {
  const type = String(value || "TEXT").toUpperCase();
  return VALID_FIELD_TYPES.has(type) ? type as FieldType : "TEXT";
}

function cleanText(value: unknown, max = 255) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length > max ? text.slice(0, max) : text;
}

function dateFromInput(value?: string | Date | null) {
  if (!value) return new Date();
  const date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? new Date() : date;
}

function mysqlDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function intOrNull(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeTagName(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 60);
}

function normalizeFieldKey(label: string, provided?: string) {
  const base = (provided || label)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  return base || `field_${Date.now()}`;
}

function parseLogRow(row: ObservationLogRow) {
  if (!row) return row;
  return {
    ...row,
    exif: parseJson(row.exif),
    pending_info: parseJson(row.pending_info),
    pendingInfo: parseJson(row.pending_info),
    metadata: parseJson(row.metadata),
    airportId: row.airport_id,
    airlineId: row.airline_id,
    acReg: row.ac_reg,
    acMsn: row.ac_msn,
    acType: row.ac_type,
    picType: row.pic_type,
    observedAt: row.observed_at,
    observedDate: row.observed_date,
    imageRawKey: row.image_raw_key,
    imageKey: row.image_key,
    imageStatus: row.image_status,
    imageWidth: row.image_width,
    imageHeight: row.image_height,
    imageSize: row.image_size,
    sourcePhotoId: row.source_photo_id,
    queuedPhotoId: row.queued_photo_id,
    queuedPhotoStatus: row.queued_photo_status,
  };
}

function parseFieldRow(row: ObservationLogRow) {
  return {
    ...row,
    fieldKey: row.field_key,
    valueType: row.value_type,
    isArchived: Boolean(row.is_archived),
    options: parseJson(row.options),
  };
}

function sqlListPlaceholders(values: unknown[]) {
  return values.map(() => "?").join(", ");
}

function buildLogFilters(filters: any = {}, values: unknown[] = [], alias = "l") {
  const where: string[] = [`${alias}.deleted_at IS NULL`];

  if (filters.dateFrom) {
    where.push(`${alias}.observed_at >= ?`);
    values.push(new Date(filters.dateFrom));
  }
  if (filters.dateTo) {
    where.push(`${alias}.observed_at <= ?`);
    values.push(new Date(filters.dateTo));
  }

  const inFilters: Array<[string, string]> = [
    ["airportIds", "airport_id"],
    ["airlineIds", "airline_id"],
    ["airtypes", "ac_type"],
    ["regs", "ac_reg"],
    ["sources", "source"],
  ];
  for (const [filterKey, column] of inFilters) {
    const raw = filters[filterKey];
    const items = Array.isArray(raw) ? raw.filter((item) => item !== null && item !== undefined && item !== "") : [];
    if (items.length > 0) {
      where.push(`${alias}.${column} IN (${sqlListPlaceholders(items)})`);
      values.push(...items);
    }
  }

  if (typeof filters.hasGalleryPhoto === "boolean") {
    where.push(`${alias}.source_photo_id IS ${filters.hasGalleryPhoto ? "NOT " : ""}NULL`);
  }

  const tags = Array.isArray(filters.tags) ? filters.tags.map(normalizeTagName).filter(Boolean) : [];
  if (tags.length > 0) {
    where.push(`EXISTS (
      SELECT 1 FROM observation_log_tag_link tl
      JOIN observation_log_tag t ON t.id = tl.tag_id
      WHERE tl.log_id = ${alias}.id AND t.user_id = ${alias}.user_id AND t.name IN (${sqlListPlaceholders(tags)})
    )`);
    values.push(...tags);
  }

  const customFields = Array.isArray(filters.customFields) ? filters.customFields : [];
  for (const filter of customFields) {
    const fieldId = Number(filter.fieldId || filter.id);
    if (!Number.isFinite(fieldId)) continue;
    const type = normalizeFieldType(filter.type || filter.valueType);
    const op = String(filter.op || "eq").toLowerCase();
    const column = type === "NUMBER"
      ? "number_value"
      : type === "DATE"
        ? "date_value"
        : type === "BOOLEAN"
          ? "bool_value"
          : type === "SELECT"
            ? "select_value"
            : "text_value";
    let comparator = "=";
    if (["gt", "gte", "lt", "lte"].includes(op)) {
      comparator = op === "gt" ? ">" : op === "gte" ? ">=" : op === "lt" ? "<" : "<=";
    }
    if (op === "contains" && column === "text_value") {
      where.push(`EXISTS (
        SELECT 1 FROM observation_log_field_value fv
        JOIN observation_log_field f ON f.id = fv.field_id
        WHERE fv.log_id = ${alias}.id AND f.user_id = ${alias}.user_id AND fv.field_id = ? AND fv.${column} LIKE ?
      )`);
      values.push(fieldId, `%${String(filter.value || "")}%`);
    } else {
      where.push(`EXISTS (
        SELECT 1 FROM observation_log_field_value fv
        JOIN observation_log_field f ON f.id = fv.field_id
        WHERE fv.log_id = ${alias}.id AND f.user_id = ${alias}.user_id AND fv.field_id = ? AND fv.${column} ${comparator} ?
      )`);
      values.push(fieldId, normalizeCustomValue(type, filter.value));
    }
  }

  return { sql: where.join(" AND "), values };
}

function normalizeCustomValue(type: FieldType, value: unknown) {
  if (type === "NUMBER") return Number(value);
  if (type === "DATE") return value ? new Date(value as string) : null;
  if (type === "BOOLEAN") {
    return value === true || value === 1 || value === "1" || value === "true";
  }
  return value === undefined || value === null ? null : String(value);
}

function buildOrder(sort?: any) {
  const field = String(sort?.field || "observedAt");
  const direction = String(sort?.direction || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
  const columns: Record<string, string> = {
    observedAt: "l.observed_at",
    id: "l.id",
    reg: "l.ac_reg",
    airport: "l.airport_id",
    airline: "l.airline_id",
    source: "l.source",
  };
  return `${columns[field] || columns.observedAt} ${direction}, l.id ${direction}`;
}

export default class ObservationLog {
  static async create(userId: number, payload: ObservationLogPayload = {}) {
    const observedAt = dateFromInput(payload.observedAt);
    const id = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `INSERT INTO observation_log
          (user_id, visibility, source, observed_at, observed_date, airport_id, airline_id,
           ac_reg, ac_msn, ac_type, pic_type, title, location_text, note, exif, pending_info, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        userId,
        normalizeVisibility(payload.visibility),
        normalizeSource(payload.source),
        observedAt,
        mysqlDate(observedAt),
        intOrNull(payload.airportId),
        intOrNull(payload.airlineId),
        cleanText(payload.acReg, 125),
        cleanText(payload.acMsn, 100),
        cleanText(payload.acType, 255),
        cleanText(payload.picType, 255),
        cleanText(payload.title, 120),
        cleanText(payload.locationText, 255),
        payload.note ?? null,
        jsonValue(payload.exif),
        jsonValue(payload.pendingInfo),
        jsonValue(payload.metadata),
      );
      const idRows = await tx.$queryRawUnsafe<{ id: number }[]>("SELECT LAST_INSERT_ID() AS id");
      return idRows[0].id;
    });
    await Promise.all([
      ObservationLog.setTags(id, userId, payload.tags || []),
      ObservationLog.setFieldValues(id, userId, payload.fields || []),
    ]);
    return ObservationLog.getOwned(id, userId);
  }

  static async list(userId: number, lastId = -1, take = 20) {
    const values: unknown[] = [userId];
    let cursor = "";
    if (lastId !== -1) {
      cursor = "AND l.id < ?";
      values.push(lastId);
    }
    values.push(Math.min(Math.max(take, 1), 100));
    const rows = await prisma.$queryRawUnsafe<ObservationLogRow[]>(
      `SELECT l.*, qp.status AS queued_photo_status
       FROM observation_log l
       LEFT JOIN photo qp ON qp.id = l.queued_photo_id
       WHERE l.user_id = ? AND l.deleted_at IS NULL ${cursor}
       ORDER BY l.observed_at DESC, l.id DESC
       LIMIT ?`,
      ...values,
    );
    return ObservationLog.attachExtras(rows.map(parseLogRow));
  }

  static async getVisible(id: number, userId?: number | null) {
    const values: unknown[] = [id];
    const visibilityClause = userId
      ? "(l.user_id = ? OR l.visibility = 'PUBLIC')"
      : "l.visibility = 'PUBLIC'";
    if (userId) values.push(userId);
    const rows = await prisma.$queryRawUnsafe<ObservationLogRow[]>(
      `SELECT l.*, qp.status AS queued_photo_status
       FROM observation_log l
       LEFT JOIN photo qp ON qp.id = l.queued_photo_id
       WHERE l.id = ? AND l.deleted_at IS NULL AND ${visibilityClause}
       LIMIT 1`,
      ...values,
    );
    const logs = await ObservationLog.attachExtras(rows.map(parseLogRow));
    return logs[0] || null;
  }

  static async getOwned(id: number, userId: number) {
    const rows = await prisma.$queryRawUnsafe<ObservationLogRow[]>(
      `SELECT l.*, qp.status AS queued_photo_status
       FROM observation_log l
       LEFT JOIN photo qp ON qp.id = l.queued_photo_id
       WHERE l.id = ? AND l.user_id = ? AND l.deleted_at IS NULL
       LIMIT 1`,
      id,
      userId,
    );
    const logs = await ObservationLog.attachExtras(rows.map(parseLogRow));
    return logs[0] || null;
  }

  static async update(id: number, userId: number, payload: ObservationLogPayload = {}) {
    const allowed: Array<[keyof ObservationLogPayload, string, (value: any) => unknown]> = [
      ["visibility", "visibility", normalizeVisibility],
      ["observedAt", "observed_at", dateFromInput],
      ["airportId", "airport_id", intOrNull],
      ["airlineId", "airline_id", intOrNull],
      ["acReg", "ac_reg", (value) => cleanText(value, 125)],
      ["acMsn", "ac_msn", (value) => cleanText(value, 100)],
      ["acType", "ac_type", (value) => cleanText(value, 255)],
      ["picType", "pic_type", (value) => cleanText(value, 255)],
      ["title", "title", (value) => cleanText(value, 120)],
      ["locationText", "location_text", (value) => cleanText(value, 255)],
      ["note", "note", (value) => value ?? null],
      ["exif", "exif", jsonValue],
      ["pendingInfo", "pending_info", jsonValue],
      ["metadata", "metadata", jsonValue],
    ];
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const [key, column, mapper] of allowed) {
      if (key in payload) {
        const mapped = mapper(payload[key]);
        sets.push(`${column} = ?`);
        values.push(mapped);
        if (key === "observedAt") {
          sets.push("observed_date = ?");
          values.push(mysqlDate(mapped as Date));
        }
      }
    }
    if (sets.length > 0) {
      values.push(id, userId);
      await prisma.$executeRawUnsafe(
        `UPDATE observation_log SET ${sets.join(", ")}
         WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
        ...values,
      );
    }
    if ("tags" in payload) {
      await ObservationLog.setTags(id, userId, payload.tags || []);
    }
    if ("fields" in payload) {
      await ObservationLog.setFieldValues(id, userId, payload.fields || []);
    }
    return ObservationLog.getOwned(id, userId);
  }

  static async softDelete(id: number, userId: number) {
    return prisma.$executeRawUnsafe(
      `UPDATE observation_log SET deleted_at = NOW()
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      id,
      userId,
    );
  }

  static async search(userId: number, body: any = {}) {
    const values: unknown[] = [userId];
    const filter = buildLogFilters(body.filters || {}, values);
    const take = Math.min(Math.max(Number(body.take || body.num || 20), 1), 100);
    if (body.lastId && Number(body.lastId) !== -1) {
      filter.sql += " AND l.id < ?";
      filter.values.push(Number(body.lastId));
    }
    filter.values.push(take);
    const rows = await prisma.$queryRawUnsafe<ObservationLogRow[]>(
      `SELECT l.*, qp.status AS queued_photo_status
       FROM observation_log l
       LEFT JOIN photo qp ON qp.id = l.queued_photo_id
       WHERE l.user_id = ? AND ${filter.sql}
       ORDER BY ${buildOrder(body.sort)}
       LIMIT ?`,
      ...filter.values,
    );
    return ObservationLog.attachExtras(rows.map(parseLogRow));
  }

  static async stats(userId: number, body: any = {}) {
    const groupBy = String(body.groupBy || "month");
    const values: unknown[] = [userId];
    const filter = buildLogFilters(body.filters || {}, values);
    let join = "";
    let bucket = "DATE_FORMAT(l.observed_at, '%Y-%m')";

    if (groupBy === "airport") bucket = "COALESCE(CAST(l.airport_id AS CHAR), '未填写')";
    if (groupBy === "airline") bucket = "COALESCE(CAST(l.airline_id AS CHAR), '未填写')";
    if (groupBy === "airtype") bucket = "COALESCE(NULLIF(l.ac_type, ''), '未填写')";
    if (groupBy === "reg") bucket = "COALESCE(NULLIF(l.ac_reg, ''), '未填写')";
    if (groupBy === "source") bucket = "l.source";
    if (groupBy.startsWith("field:")) {
      const fieldId = Number(groupBy.split(":")[1]);
      if (Number.isFinite(fieldId)) {
        join = "LEFT JOIN observation_log_field_value sfv ON sfv.log_id = l.id AND sfv.field_id = ?";
        filter.values.unshift(fieldId);
        bucket = `COALESCE(
          sfv.select_value,
          sfv.text_value,
          CAST(sfv.number_value AS CHAR),
          DATE_FORMAT(sfv.date_value, '%Y-%m-%d'),
          CAST(sfv.bool_value AS CHAR),
          '未填写'
        )`;
      }
    }

    const rows = await prisma.$queryRawUnsafe<ObservationLogRow[]>(
      `SELECT ${bucket} AS bucket,
              COUNT(*) AS total,
              COUNT(DISTINCT NULLIF(l.ac_reg, '')) AS unique_reg_count,
              MIN(l.observed_at) AS first_observed_at,
              MAX(l.observed_at) AS last_observed_at
       FROM observation_log l
       ${join}
       WHERE l.user_id = ? AND ${filter.sql}
       GROUP BY bucket
       ORDER BY total DESC, bucket ASC
       LIMIT 200`,
      ...filter.values,
    );
    return rows.map((row) => ({
      bucket: row.bucket,
      total: Number(row.total),
      uniqueRegCount: Number(row.unique_reg_count),
      firstObservedAt: row.first_observed_at,
      lastObservedAt: row.last_observed_at,
    }));
  }

  static async listFields(userId: number, includeArchived = false) {
    const values: unknown[] = [userId];
    const archived = includeArchived ? "" : "AND is_archived = false";
    const rows = await prisma.$queryRawUnsafe<ObservationLogRow[]>(
      `SELECT * FROM observation_log_field
       WHERE user_id = ? ${archived}
       ORDER BY is_archived ASC, id ASC`,
      ...values,
    );
    return rows.map(parseFieldRow);
  }

  static async createField(userId: number, payload: FieldPayload) {
    const label = cleanText(payload.label, 80);
    if (!label) throw new Error("字段名称不能为空");
    const type = normalizeFieldType(payload.valueType || payload.type);
    const id = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `INSERT INTO observation_log_field (user_id, field_key, label, value_type, options, unit)
         VALUES (?, ?, ?, ?, ?, ?)`,
        userId,
        normalizeFieldKey(label, payload.fieldKey),
        label,
        type,
        jsonValue(payload.options || null),
        cleanText(payload.unit, 32),
      );
      const rows = await tx.$queryRawUnsafe<{ id: number }[]>("SELECT LAST_INSERT_ID() AS id");
      return rows[0].id;
    });
    return ObservationLog.getField(userId, id);
  }

  static async getField(userId: number, id: number) {
    const rows = await prisma.$queryRawUnsafe<ObservationLogRow[]>(
      `SELECT * FROM observation_log_field WHERE user_id = ? AND id = ? LIMIT 1`,
      userId,
      id,
    );
    return rows[0] ? parseFieldRow(rows[0]) : null;
  }

  static async updateField(userId: number, id: number, payload: FieldPayload & { isArchived?: boolean }) {
    const sets: string[] = [];
    const values: unknown[] = [];
    if ("label" in payload) {
      sets.push("label = ?");
      values.push(cleanText(payload.label, 80));
    }
    if ("options" in payload) {
      sets.push("options = ?");
      values.push(jsonValue(payload.options));
    }
    if ("unit" in payload) {
      sets.push("unit = ?");
      values.push(cleanText(payload.unit, 32));
    }
    if ("isArchived" in payload) {
      sets.push("is_archived = ?");
      values.push(Boolean(payload.isArchived));
    }
    if (sets.length > 0) {
      values.push(id, userId);
      await prisma.$executeRawUnsafe(
        `UPDATE observation_log_field SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`,
        ...values,
      );
    }
    return ObservationLog.getField(userId, id);
  }

  static async archiveField(userId: number, id: number) {
    await prisma.$executeRawUnsafe(
      "UPDATE observation_log_field SET is_archived = true WHERE id = ? AND user_id = ?",
      id,
      userId,
    );
  }

  static async prepareImageUpload(id: number, userId: number) {
    const log = await ObservationLog.getOwned(id, userId);
    if (!log) return null;
    const rawKey = `observation-logs/${id}.raw`;
    const imageKey = `observation-logs/${id}.jpg`;
    await prisma.$executeRawUnsafe(
      `UPDATE observation_log
       SET image_raw_key = ?, image_key = ?, image_status = 'WAIT', image_width = NULL, image_height = NULL, image_size = NULL
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      rawKey,
      imageKey,
      id,
      userId,
    );
    return { uploadUrl: photoBucket.getUploadUrl(rawKey), rawKey, imageKey };
  }

  static async markImageUploading(id: number, userId: number) {
    const log = await ObservationLog.getOwned(id, userId);
    if (!log) return null;
    await prisma.$executeRawUnsafe(
      `UPDATE observation_log SET image_status = 'UPLOAD'
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      id,
      userId,
    );
    return log;
  }

  static async markImageComplete(id: number, width: number, height: number, size: number) {
    await prisma.$executeRawUnsafe(
      `UPDATE observation_log
       SET image_status = 'COMPLETE', image_width = ?, image_height = ?, image_size = ?
       WHERE id = ? AND deleted_at IS NULL`,
      width,
      height,
      size,
      id,
    );
  }

  static async markImageError(id: number) {
    await prisma.$executeRawUnsafe(
      `UPDATE observation_log SET image_status = 'ERROR'
       WHERE id = ? AND deleted_at IS NULL`,
      id,
    );
  }

  static async queueUploadFromLog(id: number, userId: number, queueInput = "NORMAL", watermark?: any) {
    const log = await ObservationLog.getOwned(id, userId);
    if (!log) return null;
    if (!log.image_key || log.image_status !== "COMPLETE") {
      throw new Error("观察日志图片尚未完成处理");
    }
    if (log.queued_photo_id) {
      return { photoId: log.queued_photo_id, reused: true };
    }
    const queue = ["PRIO", "PRIORITY"].includes(String(queueInput).toUpperCase()) ? "PRIORITY" : "NORMAL";
    const userInfo = await User.getById(userId);
    if (userInfo.free_queue <= 0 || (queue === "PRIORITY" && userInfo.free_priority_queue <= 0)) {
      throw new Error("队列已满");
    }

    const watermarkConfig = watermark || { x: 20, y: 20, s: 0.2, a: 0.35 };
    const photo = await Photo.create({
      userId,
      uploadTime: new Date(),
      reg: log.ac_reg,
      msn: log.ac_msn,
      airline: log.airline_id,
      ac_type: log.ac_type,
      airport: log.airport_id,
      picType: log.pic_type,
      photoTime: dateFromInput(log.observed_at),
      remark: (log.note || "").slice(0, 256),
      queue,
      exif: log.exif,
      watermark: JSON.stringify(watermarkConfig),
    });

    try {
      const rawKey = `photos/${photo.id}.raw`;
      const sourceStream = photoBucket.streamDownload(log.image_key);
      await photoBucket.upload(rawKey, sourceStream as any);
      await Photo.update(photo.id, { storage_status: "UPLOAD" });
      await imageProcessQueue.send(JSON.stringify({
        task: "T1-copyrightOverlay",
        params: {
          photoId: photo.id,
          inputFile: rawKey,
          outputFile: `photos/${photo.id}.jpg`,
          username: userInfo.username,
          watermark: {
            x: Number(watermarkConfig.x || 20),
            y: Number(watermarkConfig.y || 20),
            scale: Number(watermarkConfig.s || watermarkConfig.scale || 0.2),
            alpha: Number(watermarkConfig.a || watermarkConfig.alpha || 0.35),
          },
          textConfig: {
            fontSize: 16,
            fontFamily: "Source Han Sans CN",
          },
        },
      }));
      await Promise.all([
        User.updateById(userId, {
          free_queue: { decrement: 1 },
          free_priority_queue: { decrement: queue === "PRIORITY" ? 1 : 0 },
        }),
        prisma.$executeRawUnsafe(
          `UPDATE observation_log
           SET queued_photo_id = ?, source = 'QUICK_UPLOAD'
           WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
          photo.id,
          id,
          userId,
        ),
      ]);
      return { photoId: photo.id, reused: false };
    } catch (e) {
      await Photo.deleteById(photo.id);
      throw e;
    }
  }

  static async createOrLinkFromAcceptedPhoto(photoId: number) {
    const photoRows = await prisma.$queryRawUnsafe<ObservationLogRow[]>(
      `SELECT * FROM full_photo_info WHERE id = ? AND status = 'ACCEPT' LIMIT 1`,
      photoId,
    );
    const photo = photoRows[0];
    if (!photo) return null;

    const existingByQueued = await prisma.$queryRawUnsafe<ObservationLogRow[]>(
      `SELECT * FROM observation_log WHERE queued_photo_id = ? AND deleted_at IS NULL LIMIT 1`,
      photoId,
    );
    if (existingByQueued[0]) {
      await prisma.$executeRawUnsafe(
        `UPDATE observation_log
         SET source = 'ACCEPTED_PHOTO',
             source_photo_id = ?,
             image_key = ?,
             image_status = 'COMPLETE',
             airport_id = COALESCE(airport_id, ?),
             airline_id = COALESCE(airline_id, ?),
             ac_reg = COALESCE(ac_reg, ?),
             ac_msn = COALESCE(ac_msn, ?),
             ac_type = COALESCE(ac_type, ?),
             pic_type = COALESCE(pic_type, ?),
             exif = COALESCE(exif, ?)
         WHERE id = ?`,
        photoId,
        `photos/${photoId}.jpg`,
        photo.airport_id,
        photo.airline_id,
        photo.ac_reg,
        photo.ac_msn,
        photo.ac_type,
        photo.pic_type,
        jsonValue(photo.exif),
        existingByQueued[0].id,
      );
      return ObservationLog.getOwned(existingByQueued[0].id, existingByQueued[0].user_id);
    }

    const existingBySource = await prisma.$queryRawUnsafe<ObservationLogRow[]>(
      `SELECT * FROM observation_log WHERE source_photo_id = ? AND deleted_at IS NULL LIMIT 1`,
      photoId,
    );
    if (existingBySource[0]) {
      return ObservationLog.getOwned(existingBySource[0].id, existingBySource[0].user_id);
    }

    const observedAt = photo.photo_time || photo.screen_finished_time || new Date();
    const id = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `INSERT INTO observation_log
          (user_id, visibility, source, source_photo_id, observed_at, observed_date,
           airport_id, airline_id, ac_reg, ac_msn, ac_type, pic_type, note, exif, image_key, image_status)
         VALUES (?, 'PRIVATE', 'ACCEPTED_PHOTO', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETE')`,
        photo.upload_user_id,
        photoId,
        observedAt,
        mysqlDate(dateFromInput(observedAt)),
        photo.airport_id,
        photo.airline_id,
        photo.ac_reg,
        photo.ac_msn,
        photo.ac_type,
        photo.pic_type,
        photo.user_remark,
        jsonValue(photo.exif),
        `photos/${photoId}.jpg`,
      );
      const idRows = await tx.$queryRawUnsafe<{ id: number }[]>("SELECT LAST_INSERT_ID() AS id");
      return idRows[0].id;
    });
    return ObservationLog.getOwned(id, photo.upload_user_id);
  }

  static async setTags(logId: number, userId: number, tags: string[]) {
    const log = await ObservationLog.getOwned(logId, userId);
    if (!log) return;
    const cleanTags = Array.from(new Set(tags.map(normalizeTagName).filter(Boolean)));
    await prisma.$executeRawUnsafe("DELETE FROM observation_log_tag_link WHERE log_id = ?", logId);
    if (cleanTags.length === 0) return;
    for (const tag of cleanTags) {
      await prisma.$executeRawUnsafe(
        "INSERT IGNORE INTO observation_log_tag (user_id, name) VALUES (?, ?)",
        userId,
        tag,
      );
    }
    const rows = await prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM observation_log_tag
       WHERE user_id = ? AND name IN (${sqlListPlaceholders(cleanTags)})`,
      userId,
      ...cleanTags,
    );
    for (const row of rows) {
      await prisma.$executeRawUnsafe(
        "INSERT IGNORE INTO observation_log_tag_link (log_id, tag_id) VALUES (?, ?)",
        logId,
        row.id,
      );
    }
  }

  static async setFieldValues(logId: number, userId: number, fields: FieldValuePayload[]) {
    const log = await ObservationLog.getOwned(logId, userId);
    if (!log) return;
    for (const fieldValue of fields) {
      const fieldId = Number(fieldValue.fieldId || fieldValue.id);
      if (!Number.isFinite(fieldId)) continue;
      const field = await ObservationLog.getField(userId, fieldId);
      if (!field || field.isArchived) continue;
      const value = ObservationLog.prepareFieldValue(field.valueType, fieldValue);
      await prisma.$executeRawUnsafe(
        `INSERT INTO observation_log_field_value
          (log_id, field_id, text_value, number_value, date_value, bool_value, select_value)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
          text_value = VALUES(text_value),
          number_value = VALUES(number_value),
          date_value = VALUES(date_value),
          bool_value = VALUES(bool_value),
          select_value = VALUES(select_value)`,
        logId,
        fieldId,
        value.textValue,
        value.numberValue,
        value.dateValue,
        value.boolValue,
        value.selectValue,
      );
    }
  }

  private static prepareFieldValue(type: FieldType, fieldValue: FieldValuePayload) {
    const rawValue = "value" in fieldValue ? fieldValue.value : undefined;
    const boolRaw = fieldValue.boolValue ?? rawValue;
    return {
      textValue: type === "TEXT" ? String(fieldValue.textValue ?? rawValue ?? "") : null,
      numberValue: type === "NUMBER" ? Number(fieldValue.numberValue ?? rawValue) : null,
      dateValue: type === "DATE" ? (fieldValue.dateValue || rawValue ? dateFromInput(fieldValue.dateValue as any || rawValue as any) : null) : null,
      boolValue: type === "BOOLEAN" ? (boolRaw === true || boolRaw === 1 || boolRaw === "1" || boolRaw === "true") : null,
      selectValue: type === "SELECT" ? String(fieldValue.selectValue ?? rawValue ?? "") : null,
    };
  }

  private static async attachExtras(logs: any[]) {
    if (logs.length === 0) return logs;
    const ids = logs.map((log) => Number(log.id));
    const [tagRows, fieldRows] = await Promise.all([
      prisma.$queryRawUnsafe<ObservationLogRow[]>(
        `SELECT tl.log_id, t.id, t.name
         FROM observation_log_tag_link tl
         JOIN observation_log_tag t ON t.id = tl.tag_id
         WHERE tl.log_id IN (${sqlListPlaceholders(ids)})
         ORDER BY t.name ASC`,
        ...ids,
      ),
      prisma.$queryRawUnsafe<ObservationLogRow[]>(
        `SELECT fv.*, f.field_key, f.label, f.value_type, f.options, f.unit
         FROM observation_log_field_value fv
         JOIN observation_log_field f ON f.id = fv.field_id
         WHERE fv.log_id IN (${sqlListPlaceholders(ids)})
         ORDER BY f.id ASC`,
        ...ids,
      ),
    ]);
    const tags = new Map<number, any[]>();
    for (const row of tagRows) {
      const list = tags.get(row.log_id) || [];
      list.push({ id: row.id, name: row.name });
      tags.set(row.log_id, list);
    }
    const fields = new Map<number, any[]>();
    for (const row of fieldRows) {
      const list = fields.get(row.log_id) || [];
      list.push({
        id: row.id,
        fieldId: row.field_id,
        fieldKey: row.field_key,
        label: row.label,
        valueType: row.value_type,
        options: parseJson(row.options),
        unit: row.unit,
        textValue: row.text_value,
        numberValue: row.number_value,
        dateValue: row.date_value,
        boolValue: row.bool_value,
        selectValue: row.select_value,
        value: row.text_value ?? row.number_value ?? row.date_value ?? row.bool_value ?? row.select_value,
      });
      fields.set(row.log_id, list);
    }
    return logs.map((log) => ({
      ...log,
      tags: tags.get(log.id) || [],
      fields: fields.get(log.id) || [],
    }));
  }
}
