import { randomUUID } from "node:crypto";
import { GetObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env.js";

export const s3 = new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
});

export const ALLOWED_CONTENT_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
} as const;
export type AllowedContentType = keyof typeof ALLOWED_CONTENT_TYPES;

/** Keys the API itself issues. Anything else submitted with a report is rejected. */
export const UPLOAD_KEY_PATTERN =
  /^uploads\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.(jpg|png|webp|heic|mp4|mov)$/;

/**
 * Presigned POST (not PUT) so S3 itself enforces the size limit and content type
 * via policy conditions — a PUT URL cannot cap the upload size.
 */
export async function createUploadTarget(contentType: AllowedContentType) {
  const now = new Date();
  const key = `uploads/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.${ALLOWED_CONTENT_TYPES[contentType]}`;
  const { url, fields } = await createPresignedPost(s3, {
    Bucket: env.S3_BUCKET,
    Key: key,
    Expires: env.UPLOAD_URL_TTL_SECONDS,
    Conditions: [
      ["content-length-range", 1, env.UPLOAD_MAX_BYTES],
      ["eq", "$Content-Type", contentType],
    ],
    Fields: { "Content-Type": contentType },
  });
  return {
    key,
    url,
    fields,
    maxBytes: env.UPLOAD_MAX_BYTES,
    expiresAt: new Date(now.getTime() + env.UPLOAD_URL_TTL_SECONDS * 1000).toISOString(),
  };
}

/** Confirms an object was actually uploaded; returns its size and type, or null. */
export async function headObject(key: string) {
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    return { sizeBytes: head.ContentLength ?? null, contentType: head.ContentType ?? null };
  } catch {
    return null;
  }
}

export async function mediaUrl(key: string): Promise<string> {
  if (env.MEDIA_PUBLIC_BASE_URL) return `${env.MEDIA_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`;
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }), {
    expiresIn: 900,
  });
}
