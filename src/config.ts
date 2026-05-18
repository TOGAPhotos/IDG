import "dotenv/config";

export const NODE_ENV = (process.env.NODE_ENV ?? "development").trim().toLowerCase();

export const PRODUCTION_ENV = NODE_ENV === "production";

export const DEVELOPMENT_ENV = NODE_ENV === "development";

const DEVELOPMENT_DATABASE_SUFFIX = "_Dev";

function getDatabaseName(databaseUrl: string): string {
  try {
    const parsed = new URL(databaseUrl);
    return decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  } catch {
    throw new Error(
      "[startup safety] DATABASE_URL is not a valid database URL. Refusing to start in development.",
    );
  }
}

function assertSafeDevelopmentDatabase() {
  if (!DEVELOPMENT_ENV) {
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "[startup safety] DATABASE_URL is not configured. Refusing to start in development.",
    );
  }

  const databaseName = getDatabaseName(databaseUrl);
  if (!databaseName.endsWith(DEVELOPMENT_DATABASE_SUFFIX)) {
    throw new Error(
      `[startup safety] Refusing to start development server against database "${databaseName || "(empty)"}". Expected a database name ending with "${DEVELOPMENT_DATABASE_SUFFIX}".`,
    );
  }
}

assertSafeDevelopmentDatabase();

export const HTTP_PORT = Number(process.env.HTTP_PORT);

export const TOKEN_EXPIRE_TIME = 60 * 60 * 24 * 30;

export const BELL_URL = process.env.BELL_URL;

export const CORS_WHITE_LIST = (process.env.CORS_WHITE_LIST || "").split(",").filter(Boolean);

export const REDIS_DB_PASS = process.env.REDIS_DB_PASS || "";

export const TENCENTCLOUD_SECRET_ID = process.env.TENCENTCLOUD_SECRET_ID || "";
export const TENCENTCLOUD_SECRET_KEY = process.env.TENCENTCLOUD_SECRET_KEY || "";
export const TENCENTCLOUD_CDN_PKEY = process.env.TENCENTCLOUD_CDN_PKEY || "";

export const PHOTO_COS_DOMAIN = process.env.PHOTO_COS_DOMAIN || "";
export const PHOTO_COS_CDN_DOMAIN = process.env.PHOTO_COS_CDN_DOMAIN || "";

export const MAINTENANCE_MODE = process.env.MAINTENANCE_MODE === "true";
export const MAINTENANCE_KEY = process.env.MAINTENANCE_KEY || "";

export const CF_ACCESS_TEAM_DOMAIN = process.env.CF_ACCESS_TEAM_DOMAIN || "";
export const CF_ACCESS_AUD = process.env.CF_ACCESS_AUD || "";

export const startConsoleStr = `
  _______ ____   _____            _____  _           _            
 |__   __/ __ \\ / ____|   /\\     |  __ \\| |         | |           
    | | | |  | | |  __   /  \\    | |__) | |__   ___ | |_ ___  ___ 
    | | | |  | | | |_ | / /\\ \\   |  ___/| '_ \\ / _ \\| __/ _ \\/ __|
    | | | |__| | |__| |/ ____ \\  | |    | | | | (_) | || (_) \\__ \\
    |_|  \\____/ \\_____/_/    \\_\\ |_|    |_| |_|\\___/ \\__\\___/|___/
    
`;

export const BACK_LIST_UA_REGEX = new RegExp(/python-requests|python-urllib3|httpx|aiohttp|curl|wget|go-http-client|libcurl|apache-httpclient|okhttp|PostmanRuntime|insomnia|restsharp|java\/[0-9.]+|php\/[0-9.]+|ruby|perl/i)
export const LEGAL_REQ_HEADERS = [
  "user-agent",
  "accept",
  "accept-language",
  "accept-encoding",
  "referer",
  "content-type",
  "sec-fetch-site"
]
export const enum WAF_MODE {
  BYPASS,
  MONITOR,
  BLOCK
}

export const WAF_CURRENT_MODE: WAF_MODE = (() => {
  switch (process.env.WAF_MODE?.trim().toUpperCase()) {
    case "BYPASS":
      return WAF_MODE.BYPASS;
    case "MONITOR":
      return WAF_MODE.MONITOR;
    case "BLOCK":
      return WAF_MODE.BLOCK;
    default:
      return PRODUCTION_ENV ? WAF_MODE.BLOCK : WAF_MODE.MONITOR;
  }
})();
