import "dotenv/config";

export const PRODUCTION_ENV =
  (process.env.RUNNING_ENV || "PRODUCTION") === "PRODUCTION";

export const HTTP_PORT = Number(process.env.HTTP_PORT);

export const TOKEN_EXPIRE_TIME = 60 * 60 * 24 * 30;

export const BELL_URL = process.env.BELL_URL;

export const CORS_WHITE_LIST = process.env.CORS_WHITE_LIST.split(",");

export const REDIS_DB_PASS = process.env.REDIS_DB_PASS || "";

export const startConsoleStr = `
  _______ ____   _____            _____  _           _            
 |__   __/ __ \\ / ____|   /\\     |  __ \\| |         | |           
    | | | |  | | |  __   /  \\    | |__) | |__   ___ | |_ ___  ___ 
    | | | |  | | | |_ | / /\\ \\   |  ___/| '_ \\ / _ \\| __/ _ \\/ __|
    | | | |__| | |__| |/ ____ \\  | |    | | | | (_) | || (_) \\__ \\
    |_|  \\____/ \\_____/_/    \\_\\ |_|    |_| |_|\\___/ \\__\\___/|___/
    
`;
