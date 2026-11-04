import "server-only";
import { createHash, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(nodeScrypt);
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt, 64) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, expected] = stored.split(":");
  const actual = await scrypt(password, salt, 64) as Buffer;
  const hash = Buffer.from(expected, "hex");
  return hash.length === actual.length && timingSafeEqual(hash, actual);
}
export function digest(value: string) { return createHash("sha256").update(value).digest("hex"); }
export function sessionToken() { return randomBytes(32).toString("base64url"); }
