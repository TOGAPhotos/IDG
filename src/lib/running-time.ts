import { DEVELOPMENT_ENV, PRODUCTION_ENV } from "../config.js";

export async function productionOnly(func: () => Promise<void>) {
  if (!PRODUCTION_ENV) return;
  await func();
}

export async function developmentOnly(func: () => Promise<void>) {
  if (!DEVELOPMENT_ENV) return;
  await func();
}
