/**
 * AES-256-GCM encryption for sensitive intake fields at rest.
 *
 * Key: env `INTAKE_ENCRYPTION_KEY` — 32 bytes, base64-encoded.
 *   Generate with:  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 *
 * Encrypted values are stored as a self-describing string:
 *   enc:v1:<iv-b64>:<authTag-b64>:<ciphertext-b64>
 * so encrypt/decrypt is idempotent and we can detect already-encrypted values.
 */

import crypto from "crypto";
import {
  allScalarFields,
  type Beneficiary,
} from "@/lib/iul-intake/fields";
import type { IntakeData } from "@/lib/iul-intake/schema";

const PREFIX = "enc:v1:";

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.INTAKE_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("INTAKE_ENCRYPTION_KEY is not set (32-byte base64 required).");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("INTAKE_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  }
  cachedKey = key;
  return key;
}

export function isEncrypted(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(PREFIX);
}

export function encryptString(plain: string): string {
  if (plain === "") return "";
  if (isEncrypted(plain)) return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
}

export function decryptString(value: string): string {
  if (!isEncrypted(value)) return value;
  const body = value.slice(PREFIX.length);
  const [ivB64, tagB64, dataB64] = body.split(":");
  if (!ivB64 || !tagB64 || !dataB64) return "";
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return plain.toString("utf8");
}

let sensitiveKeysCache: string[] | null = null;
function sensitiveScalarKeys(): string[] {
  if (!sensitiveKeysCache) {
    sensitiveKeysCache = allScalarFields()
      .filter((f) => f.sensitive)
      .map((f) => f.key);
  }
  return sensitiveKeysCache;
}

function mapBeneficiarySsn(
  list: unknown,
  transform: (ssn: string) => string
): Beneficiary[] | undefined {
  if (!Array.isArray(list)) return undefined;
  return list.map((b) => {
    const ben = (b ?? {}) as Beneficiary;
    return {
      ...ben,
      ssn: typeof ben.ssn === "string" ? transform(ben.ssn) : ben.ssn,
    };
  });
}

/** Encrypt all sensitive values in place (returns a new object). */
export function encryptIntakeData(data: IntakeData): IntakeData {
  const out: IntakeData = { ...data };
  for (const key of sensitiveScalarKeys()) {
    const v = out[key];
    if (typeof v === "string" && v !== "") out[key] = encryptString(v);
  }
  const benies = mapBeneficiarySsn(out.beneficiaries, (ssn) =>
    ssn ? encryptString(ssn) : ssn
  );
  if (benies) out.beneficiaries = benies;
  return out;
}

/** Decrypt all sensitive values in place (returns a new object). */
export function decryptIntakeData(data: IntakeData): IntakeData {
  const out: IntakeData = { ...data };
  for (const key of sensitiveScalarKeys()) {
    const v = out[key];
    if (isEncrypted(v)) out[key] = decryptString(v);
  }
  const benies = mapBeneficiarySsn(out.beneficiaries, (ssn) =>
    isEncrypted(ssn) ? decryptString(ssn) : ssn
  );
  if (benies) out.beneficiaries = benies;
  return out;
}

/** Replace sensitive values with null (used by purge-after-sync). */
export function purgeSensitiveData(data: IntakeData): IntakeData {
  const out: IntakeData = { ...data };
  for (const key of sensitiveScalarKeys()) {
    if (out[key]) out[key] = null;
  }
  if (Array.isArray(out.beneficiaries)) {
    out.beneficiaries = out.beneficiaries.map((b) => ({ ...b, ssn: "" }));
  }
  return out;
}
