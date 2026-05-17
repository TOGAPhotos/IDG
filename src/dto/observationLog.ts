import { prisma } from "../lib/prisma.js";

type FieldType = "TEXT" | "NUMBER" | "DATE" | "BOOLEAN" | "SELECT";
type Visibility = "PRIVATE" | "PUBLIC";
type LogSource = "MANUAL" | "QUICK_UPLOAD" | "ACCEPTED_PHOTO";

type ObservationLogPayload = {
  visibility?: string;
  source?: string;
  hasImage?: boolean;
  observedAt?: string | Date;
  airportId?: number | null;
  airlineId?: number | null;
  acReg?: string | null;
  acMsn?: string | null;
  acType?: string | null;
  picType?: string | null;
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
type QueryOperator =
  | "eq"
  | "neq"
  | "in"
  | "notIn"
  | "contains"
  | "startsWith"
  | "between"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "isNull"
  | "isNotNull"
  | "exists"
  | "notExists"
  | "any"
  | "all";

type QueryValueKind = "text" | "number" | "date" | "boolean";

type QueryNode = {
  and?: QueryNode[];
  or?: QueryNode[];
  not?: QueryNode;
  field?: string;
  op?: QueryOperator | string;
  value?: unknown;
  fieldId?: number;
  id?: number;
  valueType?: string;
  type?: string;
};

type QueryBuildState = {
  values: unknown[];
  nodeCount: number;
};

class ObservationLogValidationError extends Error {}

const VALID_VISIBILITIES = new Set(["PRIVATE", "PUBLIC"]);
const VALID_SOURCES = new Set(["MANUAL", "QUICK_UPLOAD", "ACCEPTED_PHOTO"]);
const VALID_FIELD_TYPES = new Set(["TEXT", "NUMBER", "DATE", "BOOLEAN", "SELECT"]);

const LOG_SELECT = "l.*";
const LOG_FROM = "FROM observation_log_info l";
const MAX_QUERY_DEPTH = 8;
const MAX_QUERY_NODES = 80;

const QUERY_FIELD_COLUMNS: Record<string, { columns: string[]; kind: QueryValueKind }> = {
  id: { columns: ["l.id"], kind: "number" },
  observedAt: { columns: ["l.observed_at"], kind: "date" },
  createdAt: { columns: ["l.created_at"], kind: "date" },
  updatedAt: { columns: ["l.updated_at"], kind: "date" },
  airportId: { columns: ["l.airport_id"], kind: "number" },
  airportCode: { columns: ["l.airport_iata_code", "l.airport_icao_code"], kind: "text" },
  airportName: { columns: ["l.airport_cn", "l.airport_en"], kind: "text" },
  airlineId: { columns: ["l.airline_id"], kind: "number" },
  airlineCode: { columns: ["l.airline_iata_code", "l.airline_icao_code"], kind: "text" },
  airlineName: { columns: ["l.airline_cn", "l.airline_en"], kind: "text" },
  acReg: { columns: ["l.ac_reg"], kind: "text" },
  acMsn: { columns: ["l.ac_msn"], kind: "text" },
  acType: { columns: ["l.ac_type"], kind: "text" },
  picType: { columns: ["l.pic_type"], kind: "text" },
  locationText: { columns: ["l.location_text"], kind: "text" },
  note: { columns: ["l.note"], kind: "text" },
  visibility: { columns: ["l.visibility"], kind: "text" },
  source: { columns: ["l.source"], kind: "text" },
  imageStatus: { columns: ["l.image_status"], kind: "text" },
  queuedPhotoStatus: { columns: ["l.queued_photo_status"], kind: "text" },
};

const KEYWORD_COLUMNS = [
  "l.ac_reg",
  "l.ac_msn",
  "l.ac_type",
  "l.pic_type",
  "l.location_text",
  "l.note",
  "l.airport_cn",
  "l.airport_en",
  "l.airport_iata_code",
  "l.airport_icao_code",
  "l.airline_cn",
  "l.airline_en",
  "l.airline_iata_code",
  "l.airline_icao_code",
];

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

function requiredDateFromInput(value?: string | Date | null) {
  if (!value) {
    throw new ObservationLogValidationError("观察时间不能为空");
  }
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) {
    throw new ObservationLogValidationError("观察时间无效");
  }
  return date;
}

function mysqlDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function intOrNull(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function hasAirport(value: unknown) {
  const airportId = intOrNull(value);
  return airportId !== null && airportId > 0;
}

function hasReg(value: unknown) {
  return Boolean(cleanText(value, 125));
}

function hasUsableImage(log: Partial<ObservationLogRow>) {
  const imageKey =
    log.imageKey ?? log.image_key ?? log.imageRawKey ?? log.image_raw_key;
  const imageStatus = String(log.imageStatus ?? log.image_status ?? "").toUpperCase();
  return Boolean(imageKey) && imageStatus !== "NONE" && imageStatus !== "ERROR";
}

function hasStorableBasis(log: Partial<ObservationLogRow> & { hasImage?: boolean }) {
  if (log.hasImage === true || hasUsableImage(log)) return true;
  return hasReg(log.acReg ?? log.ac_reg) && hasAirport(log.airportId ?? log.airport_id);
}

function assertStorableBasis(log: Partial<ObservationLogRow> & { hasImage?: boolean }) {
  if (!hasStorableBasis(log)) {
    throw new ObservationLogValidationError("观察日志需要上传图片，或同时填写注册号和机场");
  }
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
  const airport = row.airport_id === null || row.airport_id === undefined
    ? null
    : {
      id: row.airport_id,
      airport_cn: row.airport_cn,
      airport_en: row.airport_en,
      icao_code: row.airport_icao_code,
      iata_code: row.airport_iata_code,
    };
  const airline = row.airline_id === null || row.airline_id === undefined
    ? null
    : {
      id: row.airline_id,
      airline_cn: row.airline_cn,
      airline_en: row.airline_en,
      icao_code: row.airline_icao_code,
      iata_code: row.airline_iata_code,
    };
  return {
    ...row,
    exif: parseJson(row.exif),
    pending_info: parseJson(row.pending_info),
    pendingInfo: parseJson(row.pending_info),
    metadata: parseJson(row.metadata),
    airport,
    airline,
    airportId: row.airport_id,
    airportCn: row.airport_cn,
    airportEn: row.airport_en,
    airportIcaoCode: row.airport_icao_code,
    airportIataCode: row.airport_iata_code,
    airlineId: row.airline_id,
    airlineCn: row.airline_cn,
    airlineEn: row.airline_en,
    airlineIcaoCode: row.airline_icao_code,
    airlineIataCode: row.airline_iata_code,
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(value: object, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function normalizeQueryOperator(value: unknown, fallback: QueryOperator = "eq"): QueryOperator {
  const op = String(value || fallback).trim().toLowerCase();
  if (op === "eq") return "eq";
  if (op === "neq" || op === "ne") return "neq";
  if (op === "in") return "in";
  if (op === "notin" || op === "not_in") return "notIn";
  if (op === "contains") return "contains";
  if (op === "startswith" || op === "starts_with") return "startsWith";
  if (op === "between") return "between";
  if (op === "gt") return "gt";
  if (op === "gte") return "gte";
  if (op === "lt") return "lt";
  if (op === "lte") return "lte";
  if (op === "isnull" || op === "is_null") return "isNull";
  if (op === "isnotnull" || op === "is_not_null") return "isNotNull";
  if (op === "exists") return "exists";
  if (op === "notexists" || op === "not_exists") return "notExists";
  if (op === "any") return "any";
  if (op === "all") return "all";
  throw new ObservationLogValidationError(`不支持的查询操作: ${String(value)}`);
}

function coerceQueryValue(kind: QueryValueKind, value: unknown) {
  if (value === undefined || value === null || value === "") {
    throw new ObservationLogValidationError("查询值不能为空");
  }
  if (kind === "number") {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new ObservationLogValidationError("查询数值无效");
    }
    return parsed;
  }
  if (kind === "date") {
    const date = value instanceof Date ? value : new Date(value as string);
    if (isNaN(date.getTime())) {
      throw new ObservationLogValidationError("查询日期无效");
    }
    return date;
  }
  if (kind === "boolean") {
    if (value === true || value === 1 || value === "1") return true;
    if (value === false || value === 0 || value === "0") return false;
    const text = String(value).trim().toLowerCase();
    if (text === "true") return true;
    if (text === "false") return false;
    throw new ObservationLogValidationError("查询布尔值无效");
  }
  const text = String(value).trim();
  if (!text) {
    throw new ObservationLogValidationError("查询文本不能为空");
  }
  return text;
}

function coerceQueryArray(kind: QueryValueKind, value: unknown) {
  if (!Array.isArray(value)) {
    throw new ObservationLogValidationError("查询值必须是数组");
  }
  const items = value.filter((item) => item !== undefined && item !== null && item !== "");
  if (items.length === 0) {
    throw new ObservationLogValidationError("查询数组不能为空");
  }
  return items.map((item) => coerceQueryValue(kind, item));
}

function escapeLikeValue(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function likePattern(value: unknown, mode: "contains" | "startsWith") {
  const text = escapeLikeValue(coerceQueryValue("text", value) as string);
  return mode === "startsWith" ? `${text}%` : `%${text}%`;
}

function normalizeQueryTags(value: unknown) {
  const raw = Array.isArray(value) ? value : [value];
  const tags = raw
    .map((item) => normalizeTagName(String(item || "")))
    .filter(Boolean);
  const uniqueTags = Array.from(new Set(tags));
  if (uniqueTags.length === 0) {
    throw new ObservationLogValidationError("标签查询值不能为空");
  }
  return uniqueTags;
}

function fieldValueKind(type: FieldType): QueryValueKind {
  if (type === "NUMBER") return "number";
  if (type === "DATE") return "date";
  if (type === "BOOLEAN") return "boolean";
  return "text";
}

function fieldValueColumn(type: FieldType) {
  if (type === "NUMBER") return "number_value";
  if (type === "DATE") return "date_value";
  if (type === "BOOLEAN") return "bool_value";
  if (type === "SELECT") return "select_value";
  return "text_value";
}

function joinColumnConditions(parts: string[], op: QueryOperator) {
  if (parts.length === 1) return parts[0];
  const joiner = ["neq", "notIn", "isNull", "notExists"].includes(op) ? " AND " : " OR ";
  return `(${parts.join(joiner)})`;
}

function compileSingleColumnCondition(
  column: string,
  kind: QueryValueKind,
  op: QueryOperator,
  value: unknown,
  state: QueryBuildState,
) {
  if (op === "isNull" || op === "notExists") return `${column} IS NULL`;
  if (op === "isNotNull" || op === "exists") return `${column} IS NOT NULL`;

  if (op === "eq") {
    state.values.push(coerceQueryValue(kind, value));
    return `${column} = ?`;
  }
  if (op === "neq") {
    state.values.push(coerceQueryValue(kind, value));
    return `(${column} <> ? OR ${column} IS NULL)`;
  }
  if (op === "in" || op === "notIn") {
    const items = coerceQueryArray(kind, value);
    state.values.push(...items);
    const sql = `${column} ${op === "in" ? "IN" : "NOT IN"} (${sqlListPlaceholders(items)})`;
    return op === "in" ? sql : `(${sql} OR ${column} IS NULL)`;
  }
  if (op === "contains" || op === "startsWith") {
    if (kind !== "text") {
      throw new ObservationLogValidationError("contains/startsWith 只能用于文本字段");
    }
    state.values.push(likePattern(value, op));
    return `${column} LIKE ?`;
  }
  if (op === "between") {
    if (kind !== "number" && kind !== "date") {
      throw new ObservationLogValidationError("between 只能用于数值或日期字段");
    }
    if (!Array.isArray(value) || value.length !== 2) {
      throw new ObservationLogValidationError("between 查询值必须包含两个元素");
    }
    state.values.push(coerceQueryValue(kind, value[0]), coerceQueryValue(kind, value[1]));
    return `${column} BETWEEN ? AND ?`;
  }
  if (["gt", "gte", "lt", "lte"].includes(op)) {
    if (kind !== "number" && kind !== "date") {
      throw new ObservationLogValidationError("比较操作只能用于数值或日期字段");
    }
    const comparator = op === "gt" ? ">" : op === "gte" ? ">=" : op === "lt" ? "<" : "<=";
    state.values.push(coerceQueryValue(kind, value));
    return `${column} ${comparator} ?`;
  }
  throw new ObservationLogValidationError(`不支持的字段查询操作: ${op}`);
}

function compileColumnCondition(
  columns: string[],
  kind: QueryValueKind,
  op: QueryOperator,
  value: unknown,
  state: QueryBuildState,
) {
  const parts = columns.map((column) => compileSingleColumnCondition(column, kind, op, value, state));
  return joinColumnConditions(parts, op);
}

function compileKeywordCondition(node: QueryNode, state: QueryBuildState) {
  const op = normalizeQueryOperator(node.op, "contains");
  if (op !== "contains" && op !== "startsWith" && op !== "eq") {
    throw new ObservationLogValidationError("keyword 只支持 contains、startsWith、eq");
  }
  if (op === "eq") {
    return compileColumnCondition(KEYWORD_COLUMNS, "text", "eq", node.value, state);
  }
  return compileColumnCondition(KEYWORD_COLUMNS, "text", op, node.value, state);
}

function compilePresenceCondition(node: QueryNode, trueSql: string, falseSql: string) {
  const op = normalizeQueryOperator(node.op, "eq");
  let expected: boolean;
  if (op === "exists" || op === "isNotNull") {
    expected = true;
  } else if (op === "notExists" || op === "isNull") {
    expected = false;
  } else if (op === "eq") {
    expected = hasOwn(node, "value") ? coerceQueryValue("boolean", node.value) as boolean : true;
  } else if (op === "neq") {
    expected = !(hasOwn(node, "value") ? coerceQueryValue("boolean", node.value) as boolean : true);
  } else {
    throw new ObservationLogValidationError("存在性字段只支持 eq、neq、exists、notExists、isNull、isNotNull");
  }
  return expected ? `(${trueSql})` : `(${falseSql})`;
}

function compileTagCondition(node: QueryNode, state: QueryBuildState) {
  const op = normalizeQueryOperator(node.op, "any");
  const base = `SELECT 1 FROM observation_log_tag_link tl
    JOIN observation_log_tag t ON t.id = tl.tag_id
    WHERE tl.log_id = l.id AND t.user_id = l.user_id`;

  if (op === "exists") return `EXISTS (${base})`;
  if (op === "notExists") return `NOT EXISTS (${base})`;
  if (op === "any" || op === "eq" || op === "in") {
    const tags = normalizeQueryTags(node.value);
    state.values.push(...tags);
    return `EXISTS (${base} AND t.name IN (${sqlListPlaceholders(tags)}))`;
  }
  if (op === "notIn" || op === "neq") {
    const tags = normalizeQueryTags(node.value);
    state.values.push(...tags);
    return `NOT EXISTS (${base} AND t.name IN (${sqlListPlaceholders(tags)}))`;
  }
  if (op === "all") {
    const tags = normalizeQueryTags(node.value);
    state.values.push(...tags, tags.length);
    return `EXISTS (
      ${base} AND t.name IN (${sqlListPlaceholders(tags)})
      GROUP BY tl.log_id
      HAVING COUNT(DISTINCT t.name) = ?
    )`;
  }
  throw new ObservationLogValidationError("tag 只支持 any、all、in、notIn、exists、notExists");
}

function compileCustomFieldCondition(node: QueryNode, state: QueryBuildState) {
  const fieldId = Number(node.fieldId ?? node.id);
  if (!Number.isFinite(fieldId) || fieldId <= 0) {
    throw new ObservationLogValidationError("自定义字段查询需要有效 fieldId");
  }
  const type = normalizeFieldType(node.valueType || node.type);
  const kind = fieldValueKind(type);
  const column = `fv.${fieldValueColumn(type)}`;
  const op = normalizeQueryOperator(node.op, "eq");
  const base = `SELECT 1 FROM observation_log_field_value fv
    JOIN observation_log_field f ON f.id = fv.field_id
    WHERE fv.log_id = l.id AND f.user_id = l.user_id AND fv.field_id = ?`;

  if (op === "exists") {
    state.values.push(fieldId);
    return `EXISTS (${base})`;
  }
  if (op === "notExists") {
    state.values.push(fieldId);
    return `NOT EXISTS (${base})`;
  }

  state.values.push(fieldId);
  const valueSql = compileSingleColumnCondition(column, kind, op, node.value, state);
  return `EXISTS (${base} AND ${valueSql})`;
}

function compileSearchCondition(node: QueryNode, state: QueryBuildState) {
  const field = String(node.field || "").trim();
  if (!field) {
    throw new ObservationLogValidationError("查询字段不能为空");
  }

  if (field === "keyword") return compileKeywordCondition(node, state);
  if (field === "tag") return compileTagCondition(node, state);
  if (field === "customField") return compileCustomFieldCondition(node, state);
  if (field === "hasImage") {
    return compilePresenceCondition(
      node,
      "l.image_key IS NOT NULL AND l.image_status <> 'NONE'",
      "l.image_key IS NULL OR l.image_status = 'NONE'",
    );
  }
  if (field === "hasGalleryPhoto") {
    return compilePresenceCondition(node, "l.source_photo_id IS NOT NULL", "l.source_photo_id IS NULL");
  }
  if (field === "hasQueuedPhoto") {
    return compilePresenceCondition(node, "l.queued_photo_id IS NOT NULL", "l.queued_photo_id IS NULL");
  }

  const spec = QUERY_FIELD_COLUMNS[field];
  if (!spec) {
    throw new ObservationLogValidationError(`不支持的查询字段: ${field}`);
  }
  const op = normalizeQueryOperator(node.op, "eq");
  return compileColumnCondition(spec.columns, spec.kind, op, node.value, state);
}

function compileSearchNode(node: unknown, state: QueryBuildState, depth = 0): string {
  if (depth > MAX_QUERY_DEPTH) {
    throw new ObservationLogValidationError("查询条件嵌套过深");
  }
  if (!isPlainObject(node)) {
    throw new ObservationLogValidationError("where 查询条件必须是对象");
  }
  state.nodeCount += 1;
  if (state.nodeCount > MAX_QUERY_NODES) {
    throw new ObservationLogValidationError("查询条件过多");
  }

  const hasAnd = hasOwn(node, "and");
  const hasOr = hasOwn(node, "or");
  const hasNot = hasOwn(node, "not");
  const hasField = hasOwn(node, "field");
  const branchCount = [hasAnd, hasOr, hasNot, hasField].filter(Boolean).length;
  if (branchCount === 0) {
    if (Object.keys(node).length === 0) return "";
    throw new ObservationLogValidationError("查询节点缺少 and、or、not 或 field");
  }
  if (branchCount > 1) {
    throw new ObservationLogValidationError("单个查询节点只能包含一种查询类型");
  }

  if (hasAnd || hasOr) {
    const key = hasAnd ? "and" : "or";
    const items = (node as QueryNode)[key];
    if (!Array.isArray(items)) {
      throw new ObservationLogValidationError(`${key} 查询条件必须是数组`);
    }
    const parts = items
      .map((item) => compileSearchNode(item, state, depth + 1))
      .filter(Boolean);
    if (parts.length === 0) {
      return hasAnd ? "" : "1 = 0";
    }
    return parts.length === 1 ? parts[0] : `(${parts.join(hasAnd ? " AND " : " OR ")})`;
  }

  if (hasNot) {
    const compiled = compileSearchNode((node as QueryNode).not, state, depth + 1);
    if (!compiled) {
      throw new ObservationLogValidationError("not 查询条件不能为空");
    }
    return `NOT (${compiled})`;
  }

  return compileSearchCondition(node as QueryNode, state);
}

function buildSearchWhere(where: unknown, values: unknown[] = []) {
  const state: QueryBuildState = { values, nodeCount: 0 };
  const conditions = ["l.deleted_at IS NULL"];
  const compiled = compileSearchNode(where, state);
  if (compiled) conditions.push(compiled);
  return { sql: conditions.join(" AND "), values: state.values };
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

function buildSearchOrder(sort?: any) {
  const columns: Record<string, string> = {
    id: "l.id",
    observedAt: "l.observed_at",
    createdAt: "l.created_at",
    updatedAt: "l.updated_at",
    airportId: "l.airport_id",
    airlineId: "l.airline_id",
    acReg: "l.ac_reg",
    acMsn: "l.ac_msn",
    acType: "l.ac_type",
    picType: "l.pic_type",
    source: "l.source",
    imageStatus: "l.image_status",
    queuedPhotoStatus: "l.queued_photo_status",
  };
  if (sort !== undefined && sort !== null && !isPlainObject(sort)) {
    throw new ObservationLogValidationError("sort 必须是对象");
  }
  const field = String(sort?.field || "observedAt");
  const column = columns[field];
  if (!column) {
    throw new ObservationLogValidationError(`不支持的排序字段: ${field}`);
  }
  const directionInput = String(sort?.direction || "desc").toLowerCase();
  if (directionInput !== "asc" && directionInput !== "desc") {
    throw new ObservationLogValidationError("排序方向必须是 asc 或 desc");
  }
  const direction = directionInput === "asc" ? "ASC" : "DESC";
  return field === "id"
    ? `${column} ${direction}`
    : `${column} ${direction}, l.id ${direction}`;
}

export default class ObservationLog {
  static isValidationError(error: unknown) {
    return error instanceof ObservationLogValidationError;
  }

  static async create(userId: number, payload: ObservationLogPayload = {}) {
    assertStorableBasis({
      hasImage: payload.hasImage,
      acReg: payload.acReg,
      airportId: payload.airportId,
    });
    const observedAt = requiredDateFromInput(payload.observedAt);
    const expectsImage = payload.hasImage === true;
    const id = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `INSERT INTO observation_log
          (user_id, visibility, source, observed_at, observed_date, airport_id, airline_id,
           ac_reg, ac_msn, ac_type, pic_type, location_text, note, exif, pending_info, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        cleanText(payload.locationText, 255),
        payload.note ?? null,
        jsonValue(payload.exif),
        jsonValue(payload.pendingInfo),
        jsonValue(payload.metadata),
      );
      const idRows = await tx.$queryRawUnsafe<{ id: number }[]>("SELECT LAST_INSERT_ID() AS id");
      const id = idRows[0].id;
      if (expectsImage) {
        await tx.$executeRawUnsafe(
          `UPDATE observation_log
           SET image_raw_key = ?, image_key = ?, image_status = 'WAIT'
           WHERE id = ?`,
          `observation-logs/${id}.raw`,
          `observation-logs/${id}.jpg`,
          id,
        );
      }
      return id;
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
      `SELECT ${LOG_SELECT}
       ${LOG_FROM}
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
      `SELECT ${LOG_SELECT}
       ${LOG_FROM}
       WHERE l.id = ? AND l.deleted_at IS NULL AND ${visibilityClause}
       LIMIT 1`,
      ...values,
    );
    const logs = await ObservationLog.attachExtras(rows.map(parseLogRow));
    return logs[0] || null;
  }

  static async getOwned(id: number, userId: number) {
    const rows = await prisma.$queryRawUnsafe<ObservationLogRow[]>(
      `SELECT ${LOG_SELECT}
       ${LOG_FROM}
       WHERE l.id = ? AND l.user_id = ? AND l.deleted_at IS NULL
       LIMIT 1`,
      id,
      userId,
    );
    const logs = await ObservationLog.attachExtras(rows.map(parseLogRow));
    return logs[0] || null;
  }

  static async update(id: number, userId: number, payload: ObservationLogPayload = {}) {
    const current = await ObservationLog.getOwned(id, userId);
    if (!current) return null;
    assertStorableBasis({
      hasImage: payload.hasImage === true || hasUsableImage(current),
      acReg: "acReg" in payload ? payload.acReg : current.acReg,
      airportId: "airportId" in payload ? payload.airportId : current.airportId,
    });
    const allowed: Array<[keyof ObservationLogPayload, string, (value: any) => unknown]> = [
      ["visibility", "visibility", normalizeVisibility],
      ["observedAt", "observed_at", requiredDateFromInput],
      ["airportId", "airport_id", intOrNull],
      ["airlineId", "airline_id", intOrNull],
      ["acReg", "ac_reg", (value) => cleanText(value, 125)],
      ["acMsn", "ac_msn", (value) => cleanText(value, 100)],
      ["acType", "ac_type", (value) => cleanText(value, 255)],
      ["picType", "pic_type", (value) => cleanText(value, 255)],
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
    if (payload.hasImage === true) {
      sets.push(
        "image_raw_key = ?",
        "image_key = ?",
        "image_status = 'WAIT'",
        "image_width = NULL",
        "image_height = NULL",
        "image_size = NULL",
      );
      values.push(`observation-logs/${id}.raw`, `observation-logs/${id}.jpg`);
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
    if (!isPlainObject(body)) {
      throw new ObservationLogValidationError("查询体必须是对象");
    }
    if (hasOwn(body, "filters")) {
      throw new ObservationLogValidationError("search 已切换为 where 查询体，不再支持 filters");
    }
    if (!hasOwn(body, "where")) {
      throw new ObservationLogValidationError("请提供 where 查询条件");
    }
    const values: unknown[] = [userId];
    const filter = buildSearchWhere(body.where, values);
    const take = Math.min(Math.max(Number(body.take || 20), 1), 100);
    if (hasOwn(body, "lastId") && body.lastId !== null && body.lastId !== undefined) {
      const lastId = Number(body.lastId);
      if (!Number.isFinite(lastId)) {
        throw new ObservationLogValidationError("lastId 无效");
      }
      if (lastId !== -1) {
        filter.sql += " AND l.id < ?";
        filter.values.push(lastId);
      }
    }
    if (!Number.isFinite(take)) {
      throw new ObservationLogValidationError("take 无效");
    }
    filter.values.push(take);
    const rows = await prisma.$queryRawUnsafe<ObservationLogRow[]>(
      `SELECT ${LOG_SELECT}
       ${LOG_FROM}
       WHERE l.user_id = ? AND ${filter.sql}
       ORDER BY ${buildSearchOrder(body.sort)}
       LIMIT ?`,
      ...filter.values,
    );
    return ObservationLog.attachExtras(rows.map(parseLogRow));
  }

  static async stats(userId: number, body: any = {}) {
    const groupBy = String(body.groupBy || "month");
    const values: unknown[] = [userId];
    const filter = buildLogFilters(body.filters || {}, values);
    const joins: string[] = [];
    let bucket = "DATE_FORMAT(l.observed_at, '%Y-%m')";

    if (groupBy === "airport") {
      bucket = `COALESCE(
        NULLIF(CONCAT_WS(' - ',
          NULLIF(CONCAT_WS('/', NULLIF(l.airport_iata_code, ''), NULLIF(l.airport_icao_code, '')), ''),
          NULLIF(l.airport_cn, ''),
          NULLIF(l.airport_en, '')
        ), ''),
        CAST(l.airport_id AS CHAR),
        '未填写'
      )`;
    }
    if (groupBy === "airline") {
      bucket = `COALESCE(
        NULLIF(CONCAT_WS(' - ',
          NULLIF(CONCAT_WS('/', NULLIF(l.airline_iata_code, ''), NULLIF(l.airline_icao_code, '')), ''),
          NULLIF(l.airline_cn, ''),
          NULLIF(l.airline_en, '')
        ), ''),
        CAST(l.airline_id AS CHAR),
        '未填写'
      )`;
    }
    if (groupBy === "airtype") bucket = "COALESCE(NULLIF(l.ac_type, ''), '未填写')";
    if (groupBy === "reg") bucket = "COALESCE(NULLIF(l.ac_reg, ''), '未填写')";
    if (groupBy === "source") bucket = "l.source";
    if (groupBy.startsWith("field:")) {
      const fieldId = Number(groupBy.split(":")[1]);
      if (Number.isFinite(fieldId)) {
        joins.push("LEFT JOIN observation_log_field_value sfv ON sfv.log_id = l.id AND sfv.field_id = ?");
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
       ${LOG_FROM}
       ${joins.join("\n")}
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
    return { rawKey, imageKey };
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

  static async linkQueuedPhoto(id: number, userId: number, photoId: number) {
    return prisma.$executeRawUnsafe(
      `UPDATE observation_log
       SET queued_photo_id = ?, source = 'QUICK_UPLOAD'
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      photoId,
      id,
      userId,
    );
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
