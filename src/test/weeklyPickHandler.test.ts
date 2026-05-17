import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  weekly_pick: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  accept_photo: {
    findMany: vi.fn(),
  },
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: prismaMock,
}));

const { default: WeeklyPickHandler } = await import("../handler/weeklyPick/index.js");

function mockResponse() {
  const res: any = {
    statusCode: 200,
    get: vi.fn(),
    send: vi.fn(),
    success: vi.fn(),
    fail: vi.fn(),
  };
  res.status = vi.fn(() => res);
  res.setHeader = vi.fn(() => res);
  return res;
}

describe("WeeklyPickHandler.getList", () => {
  beforeEach(() => {
    prismaMock.weekly_pick.findFirst.mockReset();
    prismaMock.weekly_pick.findMany.mockReset();
    prismaMock.accept_photo.findMany.mockReset();
  });

  it("uses the latest populated week when no week is requested", async () => {
    const latestWeek = new Date("2026-05-04T00:00:00.000Z");
    prismaMock.weekly_pick.findFirst.mockResolvedValue({ week_start: latestWeek });
    prismaMock.weekly_pick.findMany.mockResolvedValue([
      {
        week_start: latestWeek,
        photo_id: 12,
        comment: "nice light",
        author: "tester",
        author_id: 7,
        order: 0,
      },
    ]);
    prismaMock.accept_photo.findMany.mockResolvedValue([{ id: 12, ac_reg: "B-1234" }]);

    const res = mockResponse();
    await WeeklyPickHandler.getList({ query: {}, url: "/weekly-picks?test=latest" } as any, res as any);

    expect(prismaMock.weekly_pick.findFirst).toHaveBeenCalledTimes(1);
    expect(prismaMock.weekly_pick.findMany).toHaveBeenCalledWith({
      where: { week_start: latestWeek },
      orderBy: { order: "asc" },
    });
    expect(res.success).toHaveBeenCalledWith("查询成功", [
      expect.objectContaining({
        id: 12,
        photo_id: 12,
        week_start: "2026-05-04",
      }),
    ]);
  });
});
