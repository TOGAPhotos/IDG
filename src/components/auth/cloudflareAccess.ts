import jwt, { type JwtPayload } from "jsonwebtoken";
import { createPublicKey, type JsonWebKey, type KeyObject } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { CF_ACCESS_AUD, CF_ACCESS_TEAM_DOMAIN } from "../../config.js";
import { HTTP_STATUS } from "../../types/http_code.js";

type AccessJwk = JsonWebKey & {
  kid?: string;
};

interface AccessJwksResponse {
  keys?: AccessJwk[];
}

interface AccessConfig {
  teamDomain: string;
  audience: string;
}

const JWKS_CACHE_TTL_MS = 60 * 60 * 1000;
const publicKeyCache = new Map<string, { key: KeyObject; expiresAt: number }>();

function normalizeTeamDomain(teamDomain: string) {
  const trimmed = teamDomain.trim().replace(/\/+$/, "");
  if (!trimmed) {
    return "";
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function getConfig(): AccessConfig | null {
  const teamDomain = normalizeTeamDomain(process.env.CF_ACCESS_TEAM_DOMAIN || CF_ACCESS_TEAM_DOMAIN);
  const audience = (process.env.CF_ACCESS_AUD || CF_ACCESS_AUD).trim();

  if (!teamDomain || !audience) {
    return null;
  }

  return { teamDomain, audience };
}

function getHeaderValue(req: Request, headerName: string) {
  const value = req.headers[headerName];
  return Array.isArray(value) ? value[0] : value;
}

function getCacheKey(teamDomain: string, kid: string) {
  return `${teamDomain}:${kid}`;
}

async function refreshJwks(teamDomain: string) {
  const certsUrl = `${teamDomain}/cdn-cgi/access/certs`;
  const response = await fetch(certsUrl);

  if (!response.ok) {
    throw new Error(`Cloudflare Access certs request failed with ${response.status}`);
  }

  const jwks = (await response.json()) as AccessJwksResponse;
  if (!Array.isArray(jwks.keys)) {
    throw new Error("Cloudflare Access certs response is missing keys");
  }

  const expiresAt = Date.now() + JWKS_CACHE_TTL_MS;
  for (const jwk of jwks.keys) {
    if (!jwk.kid) {
      continue;
    }
    publicKeyCache.set(getCacheKey(teamDomain, jwk.kid), {
      key: createPublicKey({ key: jwk, format: "jwk" }),
      expiresAt,
    });
  }
}

async function getPublicKey(teamDomain: string, kid: string) {
  const cacheKey = getCacheKey(teamDomain, kid);
  const cached = publicKeyCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.key;
  }

  await refreshJwks(teamDomain);
  const refreshed = publicKeyCache.get(cacheKey);
  if (!refreshed || refreshed.expiresAt <= Date.now()) {
    throw new Error("Cloudflare Access signing key not found");
  }

  return refreshed.key;
}

function getStringClaim(payload: JwtPayload, claim: string) {
  const value = payload[claim];
  return typeof value === "string" ? value : undefined;
}

function getNumberClaim(payload: JwtPayload, claim: string) {
  const value = payload[claim];
  return typeof value === "number" ? value : undefined;
}

export default class CloudflareAccess {
  static async verify(token: string) {
    const config = getConfig();
    if (!config) {
      throw new Error("Cloudflare Access is not configured");
    }

    const decoded = jwt.decode(token, { complete: true });
    const kid = decoded && typeof decoded !== "string" ? decoded.header.kid : undefined;
    if (!kid) {
      throw new Error("Cloudflare Access JWT is missing kid");
    }

    const publicKey = await getPublicKey(config.teamDomain, kid);
    const payload = jwt.verify(token, publicKey, {
      algorithms: ["RS256"],
      issuer: config.teamDomain,
      audience: config.audience,
    });

    if (typeof payload === "string") {
      throw new Error("Cloudflare Access JWT payload is invalid");
    }

    return {
      sub: getStringClaim(payload, "sub"),
      email: getStringClaim(payload, "email"),
      type: getStringClaim(payload, "type"),
      identityNonce: getStringClaim(payload, "identity_nonce"),
      aud: payload.aud,
      issuer: payload.iss,
      expiresAt: getNumberClaim(payload, "exp"),
      issuedAt: getNumberClaim(payload, "iat"),
    };
  }

  static async requireAccessMW(req: Request, res: Response, next: NextFunction) {
    const config = getConfig();
    if (!config) {
      return res.fail(HTTP_STATUS.SERVER_ERROR, "Cloudflare Access 未配置");
    }

    const token = getHeaderValue(req, "cf-access-jwt-assertion");
    if (!token) {
      return res.fail(HTTP_STATUS.UNAUTHORIZED, "缺少 Cloudflare Access 凭证");
    }

    try {
      req.cfAccess = await CloudflareAccess.verify(token);
      next();
    } catch {
      return res.fail(HTTP_STATUS.FORBIDDEN, "Cloudflare Access 凭证无效");
    }
  }
}
