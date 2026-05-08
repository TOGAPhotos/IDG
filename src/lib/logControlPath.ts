export const LOG_CONTROL_PATH_PREFIX = "/api/v2/log/control";

export function isLogControlPath(path: string | undefined) {
  if (!path) {
    return false;
  }
  return path === LOG_CONTROL_PATH_PREFIX || path.startsWith(`${LOG_CONTROL_PATH_PREFIX}/`);
}
