import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  queryRawUnsafe: vi.fn(),
  executeRawUnsafe: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    $queryRawUnsafe: prismaMock.queryRawUnsafe,
    $executeRawUnsafe: prismaMock.executeRawUnsafe,
    $transaction: prismaMock.transaction,
  },
}));

const { default: ObservationLog } = await import("../dto/observationLog.js");

function sql() {
  const calls = prismaMock.queryRawUnsafe.mock.calls;
  return String(calls[calls.length - 1][0]).replace(/\s+/g, " ");
}

function args() {
  const calls = prismaMock.queryRawUnsafe.mock.calls;
  return calls[calls.length - 1].slice(1);
}

describe("ObservationLog.search", () => {
  beforeEach(() => {
    prismaMock.queryRawUnsafe.mockReset();
    prismaMock.queryRawUnsafe.mockResolvedValue([]);
    prismaMock.executeRawUnsafe.mockReset();
    prismaMock.transaction.mockReset();
  });

  it("builds nested where queries with tags, custom fields, cursor, and sort", async () => {
    const cursorDate = new Date("2026-05-10T12:00:00.000Z");
    prismaMock.queryRawUnsafe
      .mockResolvedValueOnce([{ sort_value: cursorDate }])
      .mockResolvedValueOnce([]);

    await ObservationLog.search(42, {
      where: {
        and: [
          { field: "observedAt", op: "between", value: ["2026-01-01", "2026-05-17"] },
          {
            or: [
              { field: "acReg", op: "contains", value: "B-" },
              { field: "airlineCode", op: "in", value: ["CCA", "UAL"] },
            ],
          },
          { field: "tag", op: "all", value: ["night", "special"] },
          { field: "customField", fieldId: 7, valueType: "NUMBER", op: "gte", value: 1000 },
          { not: { field: "imageStatus", op: "eq", value: "ERROR" } },
        ],
      },
      sort: { field: "observedAt", direction: "desc" },
      take: 50,
      lastId: 500,
    });

    expect(prismaMock.queryRawUnsafe).toHaveBeenCalledTimes(2);
    expect(String(prismaMock.queryRawUnsafe.mock.calls[0][0]).replace(/\s+/g, " "))
      .toContain("SELECT l.observed_at AS sort_value FROM observation_log_info l");
    expect(prismaMock.queryRawUnsafe.mock.calls[0].slice(1)).toEqual([42, 500]);
    expect(sql()).toContain("FROM observation_log_info l");
    expect(sql()).toContain("WHERE l.user_id = ? AND l.deleted_at IS NULL");
    expect(sql()).toContain("l.observed_at BETWEEN ? AND ?");
    expect(sql()).toContain("l.ac_reg LIKE ?");
    expect(sql()).toContain("l.airline_iata_code IN (?, ?)");
    expect(sql()).toContain("GROUP BY tl.log_id HAVING COUNT(DISTINCT t.name) = ?");
    expect(sql()).toContain("fv.field_id = ? AND fv.number_value >= ?");
    expect(sql()).toContain("NOT (l.image_status = ?)");
    expect(sql()).toContain("l.observed_at < ?");
    expect(sql()).toContain("l.observed_at IS NULL");
    expect(sql()).toContain("l.observed_at <=> ? AND l.id < ?");
    expect(sql()).toContain("ORDER BY l.observed_at DESC, l.id DESC LIMIT ?");
    expect(args()[0]).toBe(42);
    expect(args()[1]).toBeInstanceOf(Date);
    expect(args()[2]).toBeInstanceOf(Date);
    expect(args()).toEqual(expect.arrayContaining([
      "%B-%",
      "CCA",
      "UAL",
      "night",
      "special",
      2,
      7,
      1000,
      "ERROR",
      cursorDate,
      500,
      50,
    ]));
  });

  it("uses observedAt and id together for default list pagination", async () => {
    const cursorDate = new Date("2026-05-10T12:00:00.000Z");
    prismaMock.queryRawUnsafe
      .mockResolvedValueOnce([{ sort_value: cursorDate }])
      .mockResolvedValueOnce([]);

    await ObservationLog.list(8, 123, 20);

    expect(prismaMock.queryRawUnsafe).toHaveBeenCalledTimes(2);
    expect(String(prismaMock.queryRawUnsafe.mock.calls[0][0]).replace(/\s+/g, " "))
      .toContain("SELECT l.observed_at AS sort_value FROM observation_log_info l");
    expect(prismaMock.queryRawUnsafe.mock.calls[0].slice(1)).toEqual([8, 123]);
    expect(sql()).toContain("WHERE l.user_id = ? AND l.deleted_at IS NULL AND (l.observed_at < ? OR l.observed_at IS NULL OR (l.observed_at <=> ? AND l.id < ?))");
    expect(sql()).toContain("ORDER BY l.observed_at DESC, l.id DESC LIMIT ?");
    expect(args()).toEqual([8, cursorDate, cursorDate, 123, 20]);
  });

  it("allows an empty where object and caps take at 100", async () => {
    await ObservationLog.search(3, {
      where: {},
      sort: { field: "id", direction: "asc" },
      take: 1000,
    });

    expect(sql()).toContain("WHERE l.user_id = ? AND l.deleted_at IS NULL");
    expect(sql()).toContain("ORDER BY l.id ASC LIMIT ?");
    expect(args()).toEqual([3, 100]);
  });

  it("rejects the old filters body", async () => {
    await expect(ObservationLog.search(1, {
      filters: { tags: ["night"] },
    })).rejects.toThrow("filters");
    expect(prismaMock.queryRawUnsafe).not.toHaveBeenCalled();
  });

  it("rejects invalid custom field conditions", async () => {
    await expect(ObservationLog.search(1, {
      where: {
        field: "customField",
        valueType: "NUMBER",
        op: "gte",
        value: 100,
      },
    })).rejects.toThrow("fieldId");
    expect(prismaMock.queryRawUnsafe).not.toHaveBeenCalled();
  });
});
