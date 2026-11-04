import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { ApiError } from "@/lib/api/errors";

function key() {
  const value = process.env.AGENCY_ENCRYPTION_KEY;
  if (!value || !/^[a-f0-9]{64}$/.test(value)) throw new ApiError(503, "AGENCY_SETUP", "Configure a persistent 32-byte AGENCY_ENCRYPTION_KEY (64 hex characters).");
  return Buffer.from(value, "hex");
}
export function encryptAgency(value: unknown) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from("KANTARA-AGENCY-v1"));
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(".");
}
export function decryptAgency(payload: string): unknown {
  const encryptionKey = key();
  try {
    const [version, iv, tag, data, extra] = payload.split(".");
    if (version !== "v1" || !iv || !tag || !data || extra) throw new Error("Invalid encrypted payload");
    const cipher = createDecipheriv("aes-256-gcm", encryptionKey, Buffer.from(iv, "base64"));
    cipher.setAAD(Buffer.from("KANTARA-AGENCY-v1"));
    cipher.setAuthTag(Buffer.from(tag, "base64"));
    return JSON.parse(Buffer.concat([cipher.update(Buffer.from(data, "base64")), cipher.final()]).toString("utf8"));
  } catch { throw new ApiError(503, "AGENCY_STORAGE", "Agency data could not be decrypted. Check the original encryption key; no data was reset."); }
}
