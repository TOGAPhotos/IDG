import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { app } from "../server.js";
import { HTTP_STATUS } from "../types/http_code.js";
import Permission from "../components/auth/permissions.js";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const prisma = new PrismaClient();

const uniqueSuffix = Date.now().toString(36);
const testPassword = "Vitest@1234";

let adminId: number | null = null;
let adminToken: string | null = null;
let adminUsername = "";

let userId: number | null = null;
let userToken: string | null = null;
let baseUsername = `test_${uniqueSuffix.slice(-6)}`;

async function registerUser(label: string) {
  const email = `crud-${label}-${uniqueSuffix}@example.com`;
  const username = `${baseUsername}_${label}`;
  const res = await request(app)
    .post("/api/v2/user/register")
    .send({
      email,
      username,
      password: testPassword,
      passwordR: testPassword,
    });
  expect(res.status).toBe(HTTP_STATUS.OK);
  return {
    id: res.body.data.id as number,
    token: res.body.data.token as string,
    username,
    email,
  };
}

async function ensureAdmin() {
  if (adminToken) return;
  const admin = await registerUser("admin");
  await prisma.user.update({ where: { id: admin.id }, data: { role: Permission.admin } });
  const loginRes = await request(app).post("/api/v2/user/login").send({
    email: admin.email,
    password: testPassword,
  });
  expect(loginRes.status).toBe(HTTP_STATUS.OK);
  adminId = admin.id;
  adminToken = loginRes.body.data.token as string;
  adminUsername = admin.username;
}


beforeAll(async () => {
  await ensureAdmin();
});

describe.sequential("User CRUD", () => {
  it("creates a user", async () => {
    const registered = await registerUser("target");
    userId = registered.id;
    userToken = registered.token;
    baseUsername = registered.username;
  });

  it("reads user info", async () => {
    const res = await request(app).get(`/api/v2/user/${userId}`);
    expect(res.status).toBe(HTTP_STATUS.OK);
    expect(res.body.data?.userInfo?.id ?? res.body.data?.id).toBe(userId);
  });

  it("updates own profile", async () => {
    const newUsername = `${baseUsername}_updated`;
    const res = await request(app)
      .put(`/api/v2/user/${userId}`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ username: newUsername, allow_toga_use: false });

    expect(res.status).toBe(HTTP_STATUS.OK);
    const updated = await prisma.user.findUnique({ where: { id: userId! } });
    expect(updated?.username).toBe(newUsername);
    expect(updated?.allow_toga_use).toBe(false);
    baseUsername = newUsername;
  });

  it("prevents normal user updating others", async () => {
    const res = await request(app)
      .put(`/api/v2/user/${adminId}`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ username: `${adminUsername}_hijack` });

    expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);

    const admin = await prisma.user.findUnique({ where: { id: adminId! } });
    expect(admin?.username).toBe(adminUsername);
  });

  it("allows admin to delete user", async () => {
    const res = await request(app)
      .delete(`/api/v2/user/${userId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(HTTP_STATUS.OK);

    const deleted = await prisma.user.findUnique({ where: { id: userId! } });
    expect(deleted?.is_deleted).toBe(true);
  });
});

afterAll(async () => {
  if (adminId !== null) {
    await prisma.user.update({
      where: { id: adminId },
      data: { is_deleted: true, username: `${adminUsername}_archived`, user_email: `${uniqueSuffix}-admin@archived` },
    });
  }
  if (userId !== null) {
    await prisma.user.update({
      where: { id: userId },
      data: { is_deleted: true, username: `${baseUsername}_archived`, user_email: `${uniqueSuffix}-user@archived` },
    });
  }
  await prisma.$disconnect();
});
