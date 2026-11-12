import "server-only";
import { AwsClient } from "aws4fetch";
import { getEnv } from "@/server/config/env";
import { AppError } from "@/server/errors";

// Private object storage (Cloudflare R2 / Backblaze B2 through the S3 API).
// Only the documents service uses this. Signed URLs are short-lived and are never logged,
// stored or written to the audit log.

export class StorageNotConfiguredError extends AppError {
  constructor() {
    super("Document storage is not set up yet. Ask the Superadmin to add the storage settings.", {
      code: "STORAGE_NOT_CONFIGURED",
      status: 503,
    });
  }
}

let override = null;

/** Tests swap in an in-memory store. Pass null to go back to the real one. */
export function setStorageForTests(store) {
  override = store;
}

export function isStorageConfigured() {
  if (override) return true;
  const env = getEnv();
  return Boolean(env.S3_ENDPOINT && env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY);
}

export function getStorage() {
  if (override) return override;
  if (!isStorageConfigured()) throw new StorageNotConfiguredError();
  return s3Storage(getEnv());
}

function s3Storage(env) {
  const client = new AwsClient({
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    service: "s3",
    region: env.S3_REGION,
  });
  const base = env.S3_ENDPOINT.replace(/\/+$/, "");
  const objectUrl = (key) => `${base}/${encodeURIComponent(env.S3_BUCKET)}/${key.split("/").map(encodeURIComponent).join("/")}`;

  async function presign(method, key, { expiresIn, headers = {}, query = {} }) {
    const url = new URL(objectUrl(key));
    url.searchParams.set("X-Amz-Expires", String(expiresIn));
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    const signed = await client.sign(url.toString(), { method, headers, aws: { signQuery: true } });
    return signed.url;
  }

  return {
    /** URL the browser PUTs the file to. The Content-Type is part of the signature. */
    presignPut(key, { contentType, expiresIn = 600 }) {
      return presign("PUT", key, { expiresIn, headers: { "content-type": contentType } });
    },

    /** URL that serves the file for `expiresIn` seconds, inline or as a download. */
    presignGet(key, { fileName, contentType, download = false, expiresIn = 60 }) {
      const safeName = fileName.replace(/["\\\r\n]/g, "_");
      return presign("GET", key, {
        expiresIn,
        query: {
          "response-content-disposition": `${download ? "attachment" : "inline"}; filename="${safeName}"`,
          "response-content-type": contentType,
        },
      });
    },

    /** { size, contentType } or null when the object does not exist. */
    async head(key) {
      const res = await client.fetch(objectUrl(key), { method: "HEAD" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`Storage HEAD failed with status ${res.status}`);
      return { size: Number(res.headers.get("content-length") ?? 0), contentType: res.headers.get("content-type") ?? "" };
    },

    /** The first `length` bytes of an object, used to check the real file type. */
    async readStart(key, length = 16) {
      const res = await client.fetch(objectUrl(key), { headers: { range: `bytes=0-${length - 1}` } });
      if (!res.ok) throw new Error(`Storage read failed with status ${res.status}`);
      return new Uint8Array(await res.arrayBuffer()).slice(0, length);
    },

    async remove(key) {
      const res = await client.fetch(objectUrl(key), { method: "DELETE" });
      if (!res.ok && res.status !== 404) throw new Error(`Storage DELETE failed with status ${res.status}`);
    },
  };
}

/** In-memory store with the same shape, for tests. `put` stands in for the browser upload. */
export function createMemoryStorage() {
  const objects = new Map();
  return {
    objects,
    put(key, bytes, contentType) {
      objects.set(key, { bytes: new Uint8Array(bytes), contentType });
    },
    async presignPut(key) {
      return `memory://put/${key}`;
    },
    async presignGet(key, { download = false } = {}) {
      return `memory://get/${key}?download=${download ? 1 : 0}`;
    },
    async head(key) {
      const o = objects.get(key);
      return o ? { size: o.bytes.length, contentType: o.contentType } : null;
    },
    async readStart(key, length = 16) {
      return (objects.get(key)?.bytes ?? new Uint8Array()).slice(0, length);
    },
    async remove(key) {
      objects.delete(key);
    },
  };
}
