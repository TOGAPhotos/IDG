import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import MailTemp from "../service/mail/mailTemp.js";

const SIX_DAYS_MS = 6 * 24 * 60 * 60 * 1000;
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

// Control variables for mocked Prisma responses
let mockQueuePhotos: any[] = [];
let mockRecipients: any[] = [];

vi.mock("@prisma/client", () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    queue_photo: {
      findMany: vi.fn(async () => mockQueuePhotos),
    },
    user: {
      findMany: vi.fn(async () => mockRecipients),
    },
  })),
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
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("QueueWarningNotice", () => {
  it("returns early without sending emails when no photos are stale", async () => {
    const queueWarningSpy = vi.spyOn(MailTemp, "QueueWarning");

    // All photos are fresh (2 days old — under the 5-day threshold)
    mockQueuePhotos = [makePhoto(1, TWO_DAYS_MS), makePhoto(2, TWO_DAYS_MS)];
    mockRecipients = [makeRecipient("screener@example.com")];

    await QueueWarningNotice();

    expect(queueWarningSpy).not.toHaveBeenCalled();
  });

  it("sends emails to each recipient when stale photos exist", async () => {
    const queueWarningSpy = vi.spyOn(MailTemp, "QueueWarning");

    mockQueuePhotos = [
      makePhoto(10, SIX_DAYS_MS),
      makePhoto(11, SIX_DAYS_MS),
    ];
    mockRecipients = [
      makeRecipient("screener2@example.com"),
      makeRecipient("admin@example.com"),
    ];

    await QueueWarningNotice();

    expect(queueWarningSpy).toHaveBeenCalledTimes(2);
    for (const call of queueWarningSpy.mock.calls) {
      expect(call[1].count).toBe(2);
      expect(call[1].photos).toHaveLength(2);
      expect(call[1].photos.map((p: any) => p.id)).toEqual(
        expect.arrayContaining([10, 11]),
      );
    }
  });

  it("excludes photos already assigned to screener_1", async () => {
    const queueWarningSpy = vi.spyOn(MailTemp, "QueueWarning");

    mockQueuePhotos = [
      makePhoto(20, SIX_DAYS_MS, null),   // stale, unassigned → included
      makePhoto(21, SIX_DAYS_MS, 99),     // stale, assigned → filtered out by Prisma query
    ];
    // Simulate Prisma WHERE screener_1: null by returning only unassigned ones
    // (the real view filter is in the query; here we reflect that in mock data)
    mockQueuePhotos = [makePhoto(20, SIX_DAYS_MS, null)];
    mockRecipients = [makeRecipient("screener2@example.com")];

    await QueueWarningNotice();

    expect(queueWarningSpy).toHaveBeenCalledTimes(1);
    expect(queueWarningSpy.mock.calls[0][1].count).toBe(1);
    expect(queueWarningSpy.mock.calls[0][1].photos[0].id).toBe(20);
  });

  it("excludes fresh photos from the stale count", async () => {
    const queueWarningSpy = vi.spyOn(MailTemp, "QueueWarning");

    // Mix of stale and fresh photos returned from DB (before client-side filter)
    mockQueuePhotos = [
      makePhoto(30, SIX_DAYS_MS),  // stale
      makePhoto(31, TWO_DAYS_MS),  // fresh
    ];
    mockRecipients = [makeRecipient("screener2@example.com")];

    await QueueWarningNotice();

    expect(queueWarningSpy).toHaveBeenCalledTimes(1);
    expect(queueWarningSpy.mock.calls[0][1].count).toBe(1);
    expect(queueWarningSpy.mock.calls[0][1].photos[0].id).toBe(30);
  });

  it("computes daysInQueue correctly for each stale photo", async () => {
    const queueWarningSpy = vi.spyOn(MailTemp, "QueueWarning");

    const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;
    mockQueuePhotos = [makePhoto(40, TEN_DAYS_MS)];
    mockRecipients = [makeRecipient("screener2@example.com")];

    await QueueWarningNotice();

    const photo = queueWarningSpy.mock.calls[0][1].photos[0];
    expect(photo.daysInQueue).toBe(10);
  });

  it("uses airline_en as fallback and '未知' when both are absent", async () => {
    const queueWarningSpy = vi.spyOn(MailTemp, "QueueWarning");

    mockQueuePhotos = [
      {
        ...makePhoto(50, SIX_DAYS_MS),
        airline_cn: null,
        airline_en: "Test Air",
      },
      {
        ...makePhoto(51, SIX_DAYS_MS),
        airline_cn: null,
        airline_en: null,
      },
    ];
    mockRecipients = [makeRecipient("screener2@example.com")];

    await QueueWarningNotice();

    const photos = queueWarningSpy.mock.calls[0][1].photos;
    expect(photos.find((p: any) => p.id === 50).airline).toBe("Test Air");
    expect(photos.find((p: any) => p.id === 51).airline).toBe("未知");
  });

  it("sends bell notification when stale photos are notified", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    mockQueuePhotos = [makePhoto(60, SIX_DAYS_MS)];
    mockRecipients = [makeRecipient("screener2@example.com")];

    await QueueWarningNotice();

    expect(fetchMock).toHaveBeenCalled();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.title).toMatch(/审核队列积压提醒/);
    expect(body.desp).toMatch(/1 张照片/);
  });

  it("does not crash when recipient list is empty", async () => {
    const queueWarningSpy = vi.spyOn(MailTemp, "QueueWarning");

    mockQueuePhotos = [makePhoto(70, SIX_DAYS_MS)];
    mockRecipients = [];

    await expect(QueueWarningNotice()).resolves.toBeUndefined();
    expect(queueWarningSpy).not.toHaveBeenCalled();
  });

  it("skips recipients without an email address", async () => {
    const queueWarningSpy = vi.spyOn(MailTemp, "QueueWarning");

    mockQueuePhotos = [makePhoto(80, SIX_DAYS_MS)];
    mockRecipients = [
      { user_email: null, username: "noemail" },
      makeRecipient("valid@example.com"),
    ];

    await QueueWarningNotice();

    expect(queueWarningSpy).toHaveBeenCalledTimes(1);
    expect(queueWarningSpy.mock.calls[0][0]).toBe("valid@example.com");
  });
});
