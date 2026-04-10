import bcrypt from "bcrypt";
import crypto from "crypto";
import "dotenv/config";

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// 兼容旧版 MD5 密码（32位十六进制）
export function isLegacyHash(hash: string): boolean {
  return /^[a-f0-9]{32}$/.test(hash);
}

export function verifyLegacyPassword(password: string, hash: string): boolean {
  const legacyHash = crypto
    .createHash("md5")
    .update(password + process.env.PASSWORD_CRYPT_KEY)
    .digest("hex");
  return legacyHash === hash;
}
