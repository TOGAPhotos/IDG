import { MAINTENANCE_MODE } from "../config.js";

export const SERVICE_MODE = {
  PRODUCTION: "PRODUCTION",
  MAINTENANCE: "MAINTENANCE",
} as const;

export type ServiceMode = (typeof SERVICE_MODE)[keyof typeof SERVICE_MODE];

let currentMode: ServiceMode = MAINTENANCE_MODE
  ? SERVICE_MODE.MAINTENANCE
  : SERVICE_MODE.PRODUCTION;

export function getServiceMode(): ServiceMode {
  return currentMode;
}

export function parseServiceMode(mode: unknown): ServiceMode | null {
  if (mode === SERVICE_MODE.PRODUCTION || mode === SERVICE_MODE.MAINTENANCE) {
    return mode;
  }
  return null;
}

export function setServiceMode(mode: ServiceMode) {
  currentMode = mode;
}
