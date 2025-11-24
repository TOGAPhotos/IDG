import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { app } from "../server.js";
import { HTTP_STATUS } from "../types/http_code.js";
import Permission from "../components/auth/permissions.js";
import { describe, it, expect, afterAll } from "vitest";

const prisma = new PrismaClient();

const uniqueSuffix = Date.now().toString(36);
const testPassword = "Vitest@1234";

let screener1Token: string | null = null;
let screener2Token: string | null = null;
let screener1Id: number | null = null;
let screener2Id: number | null = null;

const trackedAirports: number[] = [];
const trackedAirlines: number[] = [];
const trackedAircraft: number[] = [];
const trackedPhotos: number[] = [];
const tempUsers: Array<{ id: number; email: string; username: string }> = [];

async function createScreenerUser(role: string, label: string) {
  const email = `screener-${label}-${uniqueSuffix}@example.com`;
  const username = `scr_${label}_${uniqueSuffix.slice(-6)}`;
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

describe("Public content endpoints", () => {
  it("returns website statistics", async () => {
    const res = await request(app).get("/api/v2/website?type=statistics");

    expect(res.status).toBe(HTTP_STATUS.OK);
    expect(res.body.data).toMatchObject({
      userNum: expect.any(Number),
      uploadQueueLen: expect.any(Number),
      photoNum: expect.any(Number),
    });
  });

  it("lists recent photos with default take", async () => {
    const res = await request(app).get("/api/v2/photos");

    if (res.status !== HTTP_STATUS.OK) {
      console.error("photos list failed", res.status, res.body);
    }
    expect(res.status).toBe(HTTP_STATUS.OK);
    expect(Array.isArray(res.body.data)).toBe(true);
    if (Array.isArray(res.body.data)) {
      expect(res.body.data.length).toBeLessThanOrEqual(20);
    }
  });

  it("supports blurry photo search", async () => {
    const res = await request(app).get(
      "/api/v2/search?type=blurry&keyword=A&lastId=-1&num=5",
    );

    expect(res.status).toBe(HTTP_STATUS.OK);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});


afterAll(async () => {
  for (const id of trackedAirports) {
    await prisma.airport.update({ where: { id }, data: { is_delete: true } });
  }
  for (const id of trackedAirlines) {
    await prisma.airline.update({ where: { id }, data: { is_delete: true } });
  }
  for (const id of trackedAircraft) {
    await prisma.aircraft.update({ where: { id }, data: { is_delete: true } });
  }
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
