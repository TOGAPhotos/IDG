import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { generateKeyPairSync, type JsonWebKey } from "node:crypto";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { fail, success } from "../exntend/response.js";
import { maintenanceModeMW } from "../middleware/maintenanceMode.js";
import logRouter from "../router/log.js";
import { SERVICE_MODE, setServiceMode } from "../components/serviceMode.js";
import { WAF } from "../components/waf/index.js";
import { parseWafMode, setWafMode } from "../components/waf/mode.js";
import { redis } from "../components/waf/store.js";
import { HTTP_STATUS } from "../types/http_code.js";

const TEAM_DOMAIN = "https://log-control.cloudflareaccess.com";
const AUDIENCE = "log-control-audience";
const ACCESS_KID = "log-control-key";

const { privateKey: accessPrivateKey, publicKey: accessPublicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});

const accessJwk = {
  ...accessPublicKey.export({ format: "jwk" }),
  kid: ACCESS_KID,
  alg: "RS256",
  use: "sig",
} as JsonWebKey & { kid: string };

function createControlApp() {
  const app = express();

  app.use(express.json());
  app.response.success = success;
  app.response.fail = fail;

  app.use(maintenanceModeMW);
  app.use((req: Request, res: Response, next: NextFunction) => {
    req.userIp = "127.0.0.1";
    req.tId = "log-control-test-trace";
    req.ua = req.headers["user-agent"] || "";
    next();
  });
  app.use(WAF);
  app.use("/api/v2/log", logRouter);
  app.get("/api/v2/website", (req: Request, res: Response) => {
    return res.success("OK", { available: true });
  });

  return app;
}

function stubCloudflareCerts() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      expect(url).toBe(`${TEAM_DOMAIN}/cdn-cgi/access/certs`);
      return new Response(JSON.stringify({ keys: [accessJwk] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );
}

function signAccessJwt(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      iss: TEAM_DOMAIN,
      aud: [AUDIENCE],
      sub: "log-control-subject",
      email: "operator@example.com",
      type: "app",
      iat: now,
      exp: now + 300,
      ...overrides,
    },
    accessPrivateKey,
    {
      algorithm: "RS256",
      keyid: ACCESS_KID,
    },
  );
}

function validAccessHeaders() {
  return { "Cf-Access-Jwt-Assertion": signAccessJwt() };
}

describe.sequential("log control routes", () => {
  let app: Express;

  beforeAll(() => {
    process.env.CF_ACCESS_TEAM_DOMAIN = TEAM_DOMAIN;
    process.env.CF_ACCESS_AUD = AUDIENCE;
    app = createControlApp();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    setServiceMode(SERVICE_MODE.PRODUCTION);
    setWafMode(parseWafMode("MONITOR")!);
    await redis.flushdb();
  });

  it("rejects control requests without a Cloudflare Access JWT", async () => {
    const res = await request(app).get("/api/v2/log/control/state");

    expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
  });

  it("rejects an app bearer token when the Cloudflare Access JWT is missing", async () => {
    const res = await request(app)
      .get("/api/v2/log/control/state")
      .set("Authorization", "Bearer application-token");

    expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
  });

  it("rejects invalid WAF and service modes", async () => {
    stubCloudflareCerts();

    const wafRes = await request(app)
      .put("/api/v2/log/control/waf-mode")
      .set(validAccessHeaders())
      .send({ mode: "DISABLED" });
    const serviceRes = await request(app)
      .put("/api/v2/log/control/service-mode")
      .set(validAccessHeaders())
      .send({ mode: "DEGRADED" });

    expect(wafRes.status).toBe(HTTP_STATUS.BAD_REQUEST);
    expect(serviceRes.status).toBe(HTTP_STATUS.BAD_REQUEST);
  });

  it("switches WAF modes and returns the current state", async () => {
    stubCloudflareCerts();

    for (const mode of ["BYPASS", "MONITOR", "BLOCK"]) {
      const updateRes = await request(app)
        .put("/api/v2/log/control/waf-mode")
        .set(validAccessHeaders())
        .send({ mode });
      const stateRes = await request(app)
        .get("/api/v2/log/control/state")
        .set(validAccessHeaders());

      expect(updateRes.status).toBe(HTTP_STATUS.OK);
      expect(updateRes.body.data.wafMode).toBe(mode);
      expect(stateRes.status).toBe(HTTP_STATUS.OK);
      expect(stateRes.body.data).toMatchObject({
        wafMode: mode,
        serviceMode: SERVICE_MODE.PRODUCTION,
      });
    }
  });

  it("blocks ordinary business routes in maintenance mode", async () => {
    stubCloudflareCerts();

    const updateRes = await request(app)
      .put("/api/v2/log/control/service-mode")
      .set(validAccessHeaders())
      .send({ mode: SERVICE_MODE.MAINTENANCE });
    const normalRes = await request(app).get("/api/v2/website");

    expect(updateRes.status).toBe(HTTP_STATUS.OK);
    expect(updateRes.body.data.serviceMode).toBe(SERVICE_MODE.MAINTENANCE);
    expect(normalRes.status).toBe(HTTP_STATUS.SERVICE_UNAVAILABLE);
  });

  it("allows control routes to switch back to production during maintenance without a maintenance key", async () => {
    stubCloudflareCerts();
    setServiceMode(SERVICE_MODE.MAINTENANCE);

    const updateRes = await request(app)
      .put("/api/v2/log/control/service-mode")
      .set(validAccessHeaders())
      .send({ mode: SERVICE_MODE.PRODUCTION });
    const normalRes = await request(app).get("/api/v2/website");

    expect(updateRes.status).toBe(HTTP_STATUS.OK);
    expect(updateRes.body.data.serviceMode).toBe(SERVICE_MODE.PRODUCTION);
    expect(normalRes.status).toBe(HTTP_STATUS.OK);
  });

  it("bypasses local WAF blocks for control routes while still requiring Cloudflare Access", async () => {
    stubCloudflareCerts();
    setWafMode(parseWafMode("BLOCK")!);
    await redis.setex("waf:block:127.0.0.1", 60, "1");

    const missingAccessRes = await request(app).get("/api/v2/log/control/state");
    const validAccessRes = await request(app)
      .get("/api/v2/log/control/state")
      .set(validAccessHeaders());

    expect(missingAccessRes.status).toBe(HTTP_STATUS.UNAUTHORIZED);
    expect(validAccessRes.status).toBe(HTTP_STATUS.OK);
    expect(validAccessRes.body.data.wafMode).toBe("BLOCK");
  });
});
