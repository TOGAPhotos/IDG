import 'dotenv/config'

export const HTTP_PORT = Number(process.env.HTTP_PORT) || 3000;

export const TOKEN_EXPIRE_TIME =  60 * 60 * 24 * 30;

export const photoBaseFolder = '/opt/1panel/apps/openresty/openresty/www/sites/photo.tp.794td.cn/index'

export const BELL_URL = process.env.BELL_URL;

export const startConsoleStr = `
  _______ ____   _____            _____  _           _            
 |__   __/ __ \\ / ____|   /\\     |  __ \\| |         | |           
    | | | |  | | |  __   /  \\    | |__) | |__   ___ | |_ ___  ___ 
    | | | |  | | | |_ | / /\\ \\   |  ___/| '_ \\ / _ \\| __/ _ \\/ __|
    | | | |__| | |__| |/ ____ \\  | |    | | | | (_) | || (_) \\__ \\
    |_|  \\____/ \\_____/_/    \\_\\ |_|    |_| |_|\\___/ \\__\\___/|___/
    
`