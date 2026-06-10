import crypto from "node:crypto";

export const newId = () => crypto.randomUUID();

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

export const createSecret = (prefix: string) => `${prefix}_${crypto.randomBytes(24).toString("base64url")}`;

