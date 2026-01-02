import "dotenv/config";

export const PRODUCTION_ENV =
  (process.env.RUNNING_ENV || "PRODUCTION") === "PRODUCTION";

export const HTTP_PORT = Number(process.env.HTTP_PORT);

export const TOKEN_EXPIRE_TIME = 60 * 60 * 24 * 30;

export const BELL_URL = process.env.BELL_URL;

export const CORS_WHITE_LIST = process.env.CORS_WHITE_LIST.split(",");

export const REDIS_DB_PASS = process.env.REDIS_DB_PASS || "";

export const TENCENTCLOUD_SECRET_ID = process.env.TENCENTCLOUD_SECRET_ID
export const TENCENTCLOUD_SECRET_KEY = process.env.TENCENTCLOUD_SECRET_KEY
export const TENCENTCLOUD_CDN_PKEY = process.env.TENCENTCLOUD_CDN_PKEY

export const PHOTO_COS_CDN_DOMAIN = process.env.PHOTO_COS_CDN_DOMAIN

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

export const WAF_CURRENT_MODE: WAF_MODE = WAF_MODE.MONITOR;