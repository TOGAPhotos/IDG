import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  queryRawUnsafe: vi.fn(),
  executeRawUnsafe: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    $queryRawUnsafe: prismaMock.queryRawUnsafe,
    $executeRawUnsafe: prismaMock.executeRawUnsafe,
  },
}));

const { default: AircraftInfoSubmission } = await import("../dto/aircraftInfoSubmission.js");

function executeSql(index: number) {
  return String(prismaMock.executeRawUnsafe.mock.calls[index][0]).replace(/\s+/g, " ");
}

describe("AircraftInfoSubmission.review", () => {
  beforeEach(() => {
    prismaMock.queryRawUnsafe.mockReset();
    prismaMock.executeRawUnsafe.mockReset();
    prismaMock.executeRawUnsafe.mockResolvedValue(1);
  });

  it("does not overwrite existing aircraft fields with empty approved submission values", async () => {
    const submission = {
      id: 11,
      reg: "B-1234",
      msn: null,
      ln: "",
      airline_id: null,
      air_type: "",
      remark: null,
    };
    prismaMock.queryRawUnsafe
      .mockResolvedValueOnce([submission])
      .mockResolvedValueOnce([{ id: 99 }])
      .mockResolvedValueOnce([{ ...submission, status: "AVAILABLE" }]);

    await AircraftInfoSubmission.review(11, 5, "AVAILABLE");

    expect(prismaMock.executeRawUnsafe).toHaveBeenCalledTimes(2);
    expect(executeSql(0)).toContain("msn = COALESCE(NULLIF(?, ''), msn)");
    expect(executeSql(0)).toContain("ln = COALESCE(NULLIF(?, ''), ln)");
    expect(executeSql(0)).toContain("airline_id = COALESCE(?, airline_id)");
    expect(executeSql(0)).toContain("air_type = COALESCE(NULLIF(?, ''), air_type)");
    expect(executeSql(0)).toContain("remark = COALESCE(NULLIF(?, ''), remark)");
    expect(prismaMock.executeRawUnsafe.mock.calls[0].slice(1)).toEqual([
      null,
      "",
      null,
      "",
      null,
      99,
    ]);
  });
});
