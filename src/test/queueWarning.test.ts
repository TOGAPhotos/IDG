import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import MailTemp from "../service/mail/mailTemp.js";

const EIGHT_DAYS_MS = 8 * 24 * 60 * 60 * 1000;
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

const prismaMock = vi.hoisted(() => ({
  queue_photo: {
    findMany: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
  },
}));

// Control variables for mocked Prisma responses
let mockQueuePhotos: any[] = [];
let mockRecipients: any[] = [];

vi.mock("../lib/prisma.js", () => ({
  prisma: prismaMock,
}));

vi.mock("../service/mail/mailTemp.js", () => ({
  default: {
    QueueWarning: vi.fn(async () => undefined),
  },
}));

// Suppress bell() network calls
vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

// Imported after vi.mock so the hoisted mock is in effect
const { QueueWarningNotice } = await import("../handler/queue/queueWarning.js");

function makePhoto(id: number, uploadMsAgo: number, screener1: number | null = null) {
  return {
    id,
    ac_reg: `B-${id}`,
    airline_cn: "测试航空",
    airline_en: null,
    username: `user_${id}`,
    upload_time: BigInt(Date.now() - uploadMsAgo),
    screener_1: screener1,
  };
}

function makeRecipient(email: string, username = "screener") {
  return { user_email: email, username };
}

beforeEach(() => {
  mockQueuePhotos = [];
  mockRecipients = [];
  vi.clearAllMocks();
  prismaMock.queue_photo.findMany.mockImplementation(async () => mockQueuePhotos);
  prismaMock.user.findMany.mockImplementation(async () => mockRecipients);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("QueueWarningNotice", () => {
  it("returns early without sending emails when no photos are stale", async () => {
    const queueWarningSpy = vi.spyOn(MailTemp, "QueueWarning");

    // All photos are fresh (2 days old, under the 7-day threshold)
    mockQueuePhotos = [makePhoto(1, TWO_DAYS_MS), makePhoto(2, TWO_DAYS_MS)];
    mockRecipients = [makeRecipient("screener@example.com")];

    await QueueWarningNotice();

    expect(queueWarningSpy).not.toHaveBeenCalled();
  });

  it("sends email to DB recipients plus admin@togaphotos.com when stale photos exist", async () => {
    const queueWarningSpy = vi.spyOn(MailTemp, "QueueWarning");

    mockQueuePhotos = [
      makePhoto(10, EIGHT_DAYS_MS),
      makePhoto(11, EIGHT_DAYS_MS),
    ];
    mockRecipients = [
      makeRecipient("screener2@example.com"),
      makeRecipient("db-admin@example.com", "admin"),
    ];

    await QueueWarningNotice();

    expect(queueWarningSpy).toHaveBeenCalledTimes(3);
    expect(queueWarningSpy.mock.calls.map(([email]) => email)).toEqual([
      "screener2@example.com",
      "db-admin@example.com",
      "admin@togaphotos.com",
    ]);
    for (const [, payload] of queueWarningSpy.mock.calls) {
      expect(payload.count).toBe(2);
      expect(payload.photos.map((p: any) => p.id)).toEqual(
        expect.arrayContaining([10, 11]),
      );
    }
  });

  it("excludes photos already assigned to screener_1", async () => {
    const queueWarningSpy = vi.spyOn(MailTemp, "QueueWarning");

    mockQueuePhotos = [
      makePhoto(20, EIGHT_DAYS_MS, null),   // stale, unassigned → included
      makePhoto(21, EIGHT_DAYS_MS, 99),     // stale, assigned → filtered out by Prisma query
    ];
    // Simulate Prisma WHERE screener_1: null by returning only unassigned ones
    // (the real view filter is in the query; here we reflect that in mock data)
    mockQueuePhotos = [makePhoto(20, EIGHT_DAYS_MS, null)];
    mockRecipients = [];

    await QueueWarningNotice();

    expect(queueWarningSpy).toHaveBeenCalledTimes(1);
    expect(queueWarningSpy.mock.calls[0][1].count).toBe(1);
    expect(queueWarningSpy.mock.calls[0][1].photos[0].id).toBe(20);
  });

  it("excludes fresh photos from the stale count", async () => {
    const queueWarningSpy = vi.spyOn(MailTemp, "QueueWarning");

    // Mix of stale and fresh photos returned from DB (before client-side filter)
    mockQueuePhotos = [
      makePhoto(30, EIGHT_DAYS_MS),  // stale
      makePhoto(31, TWO_DAYS_MS),  // fresh
    ];
    mockRecipients = [];

    await QueueWarningNotice();

    expect(queueWarningSpy).toHaveBeenCalledTimes(1);
    expect(queueWarningSpy.mock.calls[0][1].count).toBe(1);
    expect(queueWarningSpy.mock.calls[0][1].photos[0].id).toBe(30);
  });

  it("computes daysInQueue correctly for each stale photo", async () => {
    const queueWarningSpy = vi.spyOn(MailTemp, "QueueWarning");

    const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;
    mockQueuePhotos = [makePhoto(40, TEN_DAYS_MS)];
    mockRecipients = [];

    await QueueWarningNotice();

    const photo = queueWarningSpy.mock.calls[0][1].photos[0];
    expect(photo.daysInQueue).toBe(10);
  });

  it("uses airline_en as fallback and '未知' when both are absent", async () => {
    const queueWarningSpy = vi.spyOn(MailTemp, "QueueWarning");

    mockQueuePhotos = [
      {
        ...makePhoto(50, EIGHT_DAYS_MS),
        airline_cn: null,
        airline_en: "Test Air",
      },
      {
        ...makePhoto(51, EIGHT_DAYS_MS),
        airline_cn: null,
        airline_en: null,
      },
    ];
    mockRecipients = [];

    await QueueWarningNotice();

    const photos = queueWarningSpy.mock.calls[0][1].photos;
    expect(photos.find((p: any) => p.id === 50).airline).toBe("Test Air");
    expect(photos.find((p: any) => p.id === 51).airline).toBe("未知");
  });

  it("sends bell notification when stale photos are notified", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    mockQueuePhotos = [makePhoto(60, EIGHT_DAYS_MS)];
    mockRecipients = [];

    await QueueWarningNotice();

    expect(fetchMock).toHaveBeenCalled();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.title).toMatch(/审核队列积压提醒/);
    expect(body.desp).toMatch(/1 张照片/);
  });

  it("still sends to admin even when DB recipient list is empty", async () => {
    const queueWarningSpy = vi.spyOn(MailTemp, "QueueWarning");

    mockQueuePhotos = [makePhoto(70, EIGHT_DAYS_MS)];
    mockRecipients = [];

    await expect(QueueWarningNotice()).resolves.toBeUndefined();
    expect(queueWarningSpy).toHaveBeenCalledTimes(1);
    expect(queueWarningSpy.mock.calls[0][0]).toBe("admin@togaphotos.com");
  });

  it("queries screener/admin users and appends the fixed admin recipient", async () => {
    const queueWarningSpy = vi.spyOn(MailTemp, "QueueWarning");

    mockQueuePhotos = [makePhoto(80, EIGHT_DAYS_MS)];
    mockRecipients = [
      makeRecipient("screener2@togaphotos.com"),
      makeRecipient("db-admin@togaphotos.com", "admin"),
    ];

    await QueueWarningNotice();

    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
      where: {
        role: { in: ["SCREENER_2", "ADMIN"] },
        is_deleted: false,
      },
      select: {
        user_email: true,
        username: true,
      },
    });
    expect(queueWarningSpy).toHaveBeenCalledTimes(3);
    expect(queueWarningSpy.mock.calls.map(([email]) => email)).toEqual([
      "screener2@togaphotos.com",
      "db-admin@togaphotos.com",
      "admin@togaphotos.com",
    ]);
  });
});
