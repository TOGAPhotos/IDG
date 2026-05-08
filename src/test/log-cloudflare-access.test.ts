import express, { type Express } from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { generateKeyPairSync, type JsonWebKey } from "node:crypto";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { HTTP_STATUS } from "../types/http_code.js";

const TEAM_DOMAIN = "https://unit-test.cloudflareaccess.com";
const AUDIENCE = "test-audience";
const ACCESS_KID = "access-test-key";

const { privateKey: accessPrivateKey, publicKey: accessPublicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const { privateKey: otherPrivateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});

const accessJwk = {
  ...accessPublicKey.export({ format: "jwk" }),
  kid: ACCESS_KID,
  alg: "RS256",
  use: "sig",
} as JsonWebKey & { kid: string };

async function createLogApp() {
  const [{ default: logRouter }, { fail, success }] = await Promise.all([
    import("../router/log.js"),
    import("../exntend/response.js"),
  ]);

  const app = express();
  app.response.success = success;
  app.response.fail = fail;
  app.use("/api/v2/log", logRouter);
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

function signAccessJwt(overrides: Record<string, unknown> = {}, key = accessPrivateKey) {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      iss: TEAM_DOMAIN,
      aud: [AUDIENCE],
      sub: "user-subject",
      email: "admin@example.com",
      type: "app",
      iat: now,
      exp: now + 300,
      ...overrides,
    },
    key,
    {
      algorithm: "RS256",
      keyid: ACCESS_KID,
    },
  );
}

async function readReadyEvent(app: Express, token: string) {
  const server = app.listen(0);
  const port = (server.address() as AddressInfo).port;

  try {
    return await new Promise<{ body: string; contentType: string }>((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error, result?: { body: string; contentType: string }) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (error) {
          reject(error);
          return;
        }
        resolve(result!);
      };

      const timer = setTimeout(() => {
        req.destroy();
        finish(new Error("Timed out waiting for SSE ready event"));
      }, 1500);

      const req = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path: "/api/v2/log/stream",
          method: "GET",
          headers: {
            "Cf-Access-Jwt-Assertion": token,
          },
        },
        (res) => {
          if (res.statusCode !== HTTP_STATUS.OK) {
            finish(new Error(`Expected ${HTTP_STATUS.OK}, got ${res.statusCode}`));
            return;
          }

          const contentType = String(res.headers["content-type"] || "");
          let body = "";
          res.setEncoding("utf8");
          res.on("data", (chunk) => {
            body += chunk;
            if (body.includes("event: ready") && body.includes("data: {\"id\":")) {
              res.destroy();
              req.destroy();
              finish(undefined, { body, contentType });
            }
          });
          res.on("error", (error) => finish(error));
          res.on("end", () => finish(new Error("SSE stream ended before ready event")));
        },
      );

      req.on("error", (error) => finish(error));
      req.end();
    });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe.sequential("Cloudflare Access log stream auth", () => {
  let app: Express;

  beforeAll(async () => {
    process.env.CF_ACCESS_TEAM_DOMAIN = TEAM_DOMAIN;
    process.env.CF_ACCESS_AUD = AUDIENCE;
    app = await createLogApp();
  });

  beforeEach(() => {
    stubCloudflareCerts();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects requests without a Cloudflare Access JWT", async () => {
    const res = await request(app).get("/api/v2/log/stream");

    expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
  });

  it("rejects an app bearer token when the Cloudflare Access JWT is missing", async () => {
    const res = await request(app)
      .get("/api/v2/log/stream")
      .set("Authorization", "Bearer application-token");

    expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
  });

  it("rejects a token with an invalid signature", async () => {
    const res = await request(app)
      .get("/api/v2/log/stream")
      .set("Cf-Access-Jwt-Assertion", signAccessJwt({}, otherPrivateKey));

    expect(res.status).toBe(HTTP_STATUS.FORBIDDEN);
  });

  it("rejects a token with the wrong issuer", async () => {
    const res = await request(app)
      .get("/api/v2/log/stream")
      .set("Cf-Access-Jwt-Assertion", signAccessJwt({ iss: "https://other.cloudflareaccess.com" }));

    expect(res.status).toBe(HTTP_STATUS.FORBIDDEN);
  });

  it("rejects a token with the wrong audience", async () => {
    const res = await request(app)
      .get("/api/v2/log/stream")
      .set("Cf-Access-Jwt-Assertion", signAccessJwt({ aud: ["other-audience"] }));

    expect(res.status).toBe(HTTP_STATUS.FORBIDDEN);
  });

  it("rejects an expired token", async () => {
    const now = Math.floor(Date.now() / 1000);
    const res = await request(app)
      .get("/api/v2/log/stream")
      .set("Cf-Access-Jwt-Assertion", signAccessJwt({ exp: now - 10 }));

    expect(res.status).toBe(HTTP_STATUS.FORBIDDEN);
  });

  it("accepts a valid Cloudflare Access JWT and opens the SSE stream", async () => {
    const { body, contentType } = await readReadyEvent(app, signAccessJwt());

    expect(contentType).toContain("text/event-stream");
    expect(body).toContain("event: ready");
    expect(body).toContain("data: {\"id\":");
  });
});

describe.sequential("Cloudflare Access log stream config", () => {
  it("returns 500 when Cloudflare Access is not configured", async () => {
    const previousTeamDomain = process.env.CF_ACCESS_TEAM_DOMAIN;
    const previousAudience = process.env.CF_ACCESS_AUD;

    vi.resetModules();
    delete process.env.CF_ACCESS_TEAM_DOMAIN;
    delete process.env.CF_ACCESS_AUD;

    try {
      const app = await createLogApp();
      const res = await request(app)
        .get("/api/v2/log/stream")
        .set("Cf-Access-Jwt-Assertion", signAccessJwt());

      expect(res.status).toBe(HTTP_STATUS.SERVER_ERROR);
    } finally {
      if (previousTeamDomain === undefined) {
        delete process.env.CF_ACCESS_TEAM_DOMAIN;
      } else {
        process.env.CF_ACCESS_TEAM_DOMAIN = previousTeamDomain;
      }
      if (previousAudience === undefined) {
        delete process.env.CF_ACCESS_AUD;
      } else {
        process.env.CF_ACCESS_AUD = previousAudience;
      }
    }
  });
});
