// Cloud storage abstraction — S3-compatible (AWS S3, Cloudflare R2, MinIO).
//
// When S3_ACCESS_KEY_ID is set, all uploads/downloads go to the configured
// bucket. When unset (local dev), uploads are no-ops and download URLs point
// to a local fallback route — so file generation keeps working without cloud.

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { logger } from "./logger";

const s3 = process.env.S3_ACCESS_KEY_ID
  ? new S3Client({
      region: process.env.S3_REGION || "auto",
      endpoint: process.env.S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        // Non-null assertion is safe: the outer guard checks S3_ACCESS_KEY_ID,
        // and AwsCredentialIdentity requires both fields to be string. If the
        // secret is missing the SDK will throw a clear auth error at call time.
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      },
    })
  : null;

const BUCKET = process.env.S3_BUCKET || "quaesitor-uploads";

/**
 * Upload a buffer to S3/R2. Returns the object key.
 * When S3 is not configured (local dev), returns the key without uploading
 * so callers can keep using the local fallback URL.
 */
export async function uploadFile(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  if (!s3) {
    logger.warn({ key }, "S3 not configured, skipping upload");
    return key; // Return key anyway for local dev
  }
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  logger.info({ key, bucket: BUCKET, size: body.length }, "File uploaded to S3");
  return key;
}

/**
 * Get a presigned download URL for an object.
 * When S3 is not configured, returns a local fallback URL.
 */
export async function getDownloadUrl(
  key: string,
  expiresIn = 3600
): Promise<string> {
  if (!s3) {
    return `/api/files/local/${encodeURIComponent(key)}`; // Local fallback
  }
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn }
  );
}

/**
 * Delete an object from S3/R2. No-op when S3 is not configured.
 */
export async function deleteFile(key: string): Promise<void> {
  if (!s3) return;
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  logger.info({ key, bucket: BUCKET }, "File deleted from S3");
}

/**
 * Whether cloud storage (S3/R2) is configured and active.
 */
export function isStorageConfigured(): boolean {
  return s3 !== null;
}
