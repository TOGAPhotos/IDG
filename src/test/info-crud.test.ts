import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { app } from "../server.js";
import { HTTP_STATUS } from "../types/http_code.js";
import Permission from "../components/auth/permissions.js";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { BypassWAF } from "./waf-bypass.js";

const prisma = new PrismaClient();

const uniqueSuffix = Date.now().toString(36);
const testPassword = "Vitest@1234";

let screener1Token: string | null = null;
let screener2Token: string | null = null;
let screener1Id: number | null = null;
let screener2Id: number | null = null;

let airportId: number | null = null;
let airlineId: number | null = null;
let aircraftId: number | null = null;
let supportAirlineId: number | null = null;

const tempUsers: Array<{ id: number; email: string; username: string }> = [];

async function createScreenerUser(role: string, label: string) {
  const email = `crud-screener-${label}-${uniqueSuffix}@example.com`;
  const username = `crud_scr_${label}_${uniqueSuffix.slice(-6)}`;
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
  const [screener1, screener2] = await Promise.all([
    createScreenerUser(Permission.screener1, "a"),
    createScreenerUser(Permission.screener2, "b"),
  ]);
  screener1Id = screener1.id;
  screener2Id = screener2.id;
  screener1Token = screener1.token;
  screener2Token = screener2.token;
}

beforeAll(async () => {
  BypassWAF();
  await ensureScreenerUsers();
});

describe.sequential("Airport CRUD", () => {
  it("creates airport", async () => {
    const airportPayload = {
      airport_cn: `CRUD Airport CN ${uniqueSuffix}`,
      airport_en: `CRUD Airport ${uniqueSuffix}`,
      iata_code: `C${uniqueSuffix.slice(-2)}`,
      icao_code: `D${uniqueSuffix.slice(-3)}`,
    };

    const createRes = await request(app)
      .post("/api/v2/airport")
      .set("Authorization", `Bearer ${screener2Token}`)
      .send(airportPayload);
    expect(createRes.status).toBe(HTTP_STATUS.OK);

    const created = await prisma.airport.findFirst({
      where: { icao_code: airportPayload.icao_code },
    });
    expect(created).toBeTruthy();
    airportId = created!.id;
  });

  it("reads airport", async () => {
    const res = await request(app).get(`/api/v2/airport/${airportId}`);
    expect(res.status).toBe(HTTP_STATUS.OK);
    expect(res.body.data.id).toBe(airportId);
  });

  it("updates airport", async () => {
    const newName = `CRUD Airport ${uniqueSuffix} Updated`;
    const res = await request(app)
      .put(`/api/v2/airport/${airportId}`)
      .set("Authorization", `Bearer ${screener2Token}`)
      .send({ airport_en: newName });
    expect(res.status).toBe(HTTP_STATUS.OK);

    const updated = await prisma.airport.findUnique({ where: { id: airportId! } });
    expect(updated?.airport_en).toBe(newName);
  });

  it("deletes airport", async () => {
    const res = await request(app)
      .delete(`/api/v2/airport/${airportId}`)
      .set("Authorization", `Bearer ${screener2Token}`);
    expect(res.status).toBe(HTTP_STATUS.OK);

    const deleted = await prisma.airport.findUnique({ where: { id: airportId! } });
    expect(deleted?.is_delete).toBe(true);
  });
});

describe.sequential("Airline CRUD", () => {
  it("creates airline", async () => {
    const airlinePayload = {
      airline_cn: `CRUD Airline CN ${uniqueSuffix}`,
      airline_en: `CRUD Airline ${uniqueSuffix}`,
      iata_code: `A${uniqueSuffix.slice(-2)}`,
      icao_code: `Z${uniqueSuffix.slice(-3)}`,
    };

    const res = await request(app)
      .post("/api/v2/airline")
      .set("Authorization", `Bearer ${screener1Token}`)
      .send(airlinePayload);
    expect(res.status).toBe(HTTP_STATUS.OK);

    const created = await prisma.airline.findFirst({
      where: { icao_code: airlinePayload.icao_code },
    });
    expect(created).toBeTruthy();
    airlineId = created!.id;
  });

  it("reads airline", async () => {
    const res = await request(app).get(`/api/v2/airline/${airlineId}`);
    expect(res.status).toBe(HTTP_STATUS.OK);
    expect(res.body.data.id).toBe(airlineId);
  });

  it("updates airline", async () => {
    const newName = `CRUD Airline ${uniqueSuffix} Updated`;
    const res = await request(app)
      .put(`/api/v2/airline/${airlineId}`)
      .set("Authorization", `Bearer ${screener1Token}`)
      .send({ airline_en: newName });
    expect(res.status).toBe(HTTP_STATUS.OK);

    const updated = await prisma.airline.findUnique({ where: { id: airlineId! } });
    expect(updated?.airline_en).toBe(newName);
  });

  it("deletes airline", async () => {
    const res = await request(app)
      .delete(`/api/v2/airline/${airlineId}`)
      .set("Authorization", `Bearer ${screener1Token}`);
    expect(res.status).toBe(HTTP_STATUS.OK);

    const deleted = await prisma.airline.findUnique({ where: { id: airlineId! } });
    expect(deleted?.is_delete).toBe(true);
  });
});

describe.sequential("Aircraft CRUD", () => {
  it("creates aircraft", async () => {
    const supportAirline = await prisma.airline.create({
      data: {
        airline_cn: `Support Airline CN ${uniqueSuffix}`,
        airline_en: `Support Airline ${uniqueSuffix}`,
        iata_code: `S${uniqueSuffix.slice(-2)}`,
        icao_code: `S${uniqueSuffix.slice(-3)}`,
        status: "AVAILABLE",
        is_delete: false,
        create_user: screener2Id!,
      },
    });
    supportAirlineId = supportAirline.id;

    const aircraftPayload = {
      reg: `REG-${uniqueSuffix.slice(-5)}`,
      msn: `MSN-${uniqueSuffix.slice(-4)}`,
      ln: `LN-${uniqueSuffix.slice(-3)}`,
      airlineId: supportAirline.id,
      remark: "initial remark",
    };

    const res = await request(app)
      .post("/api/v2/aircrafts")
      .set("content-type", "application/json")
      .set("Authorization", `Bearer ${screener2Token}`)
      .send(aircraftPayload);
    expect(res.status).toBe(HTTP_STATUS.OK);
    aircraftId = res.body.data?.id as number;
    expect(typeof aircraftId).toBe("number");
  });

  it("reads aircraft", async () => {
    const res = await request(app)
      .get(`/api/v2/aircraft/${aircraftId}`)
      .set("Authorization", `Bearer ${screener2Token}`);
    expect(res.status).toBe(HTTP_STATUS.OK);
    expect(res.body.data.id).toBe(aircraftId);
  });

  it("updates aircraft", async () => {
    const newRemark = "initial remark updated";
    const res = await request(app)
      .put(`/api/v2/aircraft/${aircraftId}`)
      .set("Authorization", `Bearer ${screener1Token}`)
      .send({ remark: newRemark });
    expect(res.status).toBe(HTTP_STATUS.OK);

    const updated = await prisma.aircraft.findUnique({ where: { id: aircraftId! } });
    expect(updated?.remark).toBe(newRemark);
  });

  it("deletes aircraft", async () => {
    const res = await request(app)
      .delete(`/api/v2/aircraft/${aircraftId}`)
      .set("Authorization", `Bearer ${screener2Token}`);

    expect(res.status).toBe(HTTP_STATUS.OK);
    const deleted = await prisma.aircraft.findUnique({ where: { id: aircraftId! } });
    expect(deleted?.is_delete).toBe(true);
  });
});

describe("Notam", () => {

  it("Create NOTAM record", async () => {
    const notamPayload = {
      title: `Test NOTAM ${uniqueSuffix}`,
      content: `This is a test NOTAM content created at ${new Date().toISOString()}`,
    };

    await prisma.user.update({
      where: { id: screener1Id! },
      data: { role: Permission.admin },
    })

    const res = await request(app)
      .post("/api/v2/notam")
      .set("Authorization", `Bearer ${screener1Token}`)
      .send(notamPayload);
    expect(res.status).toBe(HTTP_STATUS.OK);

    const created = await prisma.notam.findFirst({
      where: { content: notamPayload.content },
    });
    expect(created).toBeTruthy();
  });

  it("Get NOTAM records", async () => {
    const res = await request(app).get("/api/v2/notam");

    expect(res.status).toBe(HTTP_STATUS.OK);
    expect(res.body).toHaveProperty("data");
  });

});

afterAll(async () => {
  if (airportId !== null) {
    await prisma.airport.update({
      where: { id: airportId },
      data: { is_delete: true },
    });
  }
  if (airlineId !== null) {
    await prisma.airline.update({
      where: { id: airlineId },
      data: { is_delete: true },
    });
  }
  if (supportAirlineId !== null) {
    await prisma.airline.update({
      where: { id: supportAirlineId },
      data: { is_delete: true },
    });
  }
  if (aircraftId !== null) {
    await prisma.aircraft.update({
      where: { id: aircraftId },
      data: { is_delete: true },
    });
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
