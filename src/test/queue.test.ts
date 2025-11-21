import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { app } from "../server.js";
import { HTTP_STATUS } from "../types/http_code.js";
import Permission from "../components/auth/permissions.js";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const prisma = new PrismaClient();

const uniqueSuffix = Date.now().toString(36);
const testPassword = "Vitest@1234";

let screener1Token: string | null = null;
let screener2Token: string | null = null;
let screener1Id: number | null = null;
let screener2Id: number | null = null;

const trackedPhotos: number[] = [];
const tempUsers: Array<{ id: number; email: string; username: string }> = [];

async function createScreenerUser(role: string, label: string) {
  const email = `queue-screener-${label}-${uniqueSuffix}@example.com`;
  const username = `queue_scr_${label}_${uniqueSuffix.slice(-6)}`;
  const registerRes = await request(app).post("/api/v2/user/register").send({
    email,
    username,
    password: testPassword,
    passwordR: testPassword,
  });
  expect(registerRes.status).toBe(HTTP_STATUS.OK);
  const newId = registerRes.body.data.id as number;
  await prisma.user.update({ where: { id: newId }, data: { role } });
  const loginRes = await request(app).post("/api/v2/user/login").send({
    email,
    password: testPassword,
  });
  expect(loginRes.status).toBe(HTTP_STATUS.OK);
  tempUsers.push({ id: newId, email, username });
  return { id: newId, token: loginRes.body.data.token as string };
}

async function ensureScreenerUsers() {
  if (screener1Token && screener2Token) return;
  const screener1 = await createScreenerUser(Permission.screener1, "a");
  const screener2 = await createScreenerUser(Permission.screener2, "b");
  screener1Id = screener1.id;
  screener2Id = screener2.id;
  screener1Token = screener1.token;
  screener2Token = screener2.token;
}

beforeAll(async () => {
  await ensureScreenerUsers();
});

describe.sequential("Queue basic access", () => {
  it("rejects unauthenticated queue access", async () => {
    const res = await request(app).get("/api/v2/queue");
    expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
  });
});

describe.sequential("Queue photo locking", () => {
  it("allows a screener to fetch a queued photo", async () => {
    const queuePhoto = await prisma.photo.create({
      data: {
        status: "WAIT SCREEN",
        queue: "NORMAL",
        upload_user_id: screener1Id || undefined,
        ac_reg: `REG-${uniqueSuffix.slice(-5)}`,
        ac_msn: `MSN-${uniqueSuffix.slice(-4)}`,
        ac_type: "TestType",
        airline: "TestAirline",
        photo_time: new Date(),
        upload_time: BigInt(Date.now()),
      },
    });
    trackedPhotos.push(queuePhoto.id);

    const res = await request(app)
      .get(`/api/v2/queue/photo/${queuePhoto.id}`)
      .set("Authorization", `Bearer ${screener1Token}`);

    expect(res.status).toBe(HTTP_STATUS.OK);
    expect(res.body.data?.id ?? res.body.data?.photo?.id).toBe(queuePhoto.id);
  });

  it("blocks another screener from grabbing the same photo", async () => {
    const queuePhoto = await prisma.photo.create({
      data: {
        status: "WAIT SCREEN",
        queue: "NORMAL",
        upload_user_id: screener1Id || undefined,
        ac_reg: `REG-${uniqueSuffix.slice(-5)}-B`,
        ac_msn: `MSN-${uniqueSuffix.slice(-4)}-B`,
        ac_type: "TestType",
        airline: "TestAirline",
        photo_time: new Date(),
        upload_time: BigInt(Date.now()),
      },
    });
    trackedPhotos.push(queuePhoto.id);

    const first = await request(app)
      .get(`/api/v2/queue/photo/${queuePhoto.id}`)
      .set("Authorization", `Bearer ${screener1Token}`);
    expect(first.status).toBe(HTTP_STATUS.OK);

    const second = await request(app)
      .get(`/api/v2/queue/photo/${queuePhoto.id}`)
      .set("Authorization", `Bearer ${screener2Token}`);
    expect(second.status).toBe(HTTP_STATUS.CONFLICT);
    expect(second.body.msg).toBeDefined();
  });
});

afterAll(async () => {
  for (const id of trackedPhotos) {
    await prisma.photo.update({ where: { id }, data: { is_delete: true } });
  }

  for (const user of tempUsers) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        is_deleted: true,
        username: `${user.username}_archived`,
        user_email: `${user.email}.deleted`,
      },
    });
  }
  await prisma.$disconnect();
});
