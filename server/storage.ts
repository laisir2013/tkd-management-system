// Cloudflare R2 storage helpers using S3 compatible API
// R2 provides S3-compatible API, so we use @aws-sdk/client-s3

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { ENV } from './_core/env';

let s3Client: S3Client | null = null;

function getR2Client(): S3Client {
  if (s3Client) return s3Client;

  const accountId = ENV.r2AccountId;
  const accessKeyId = ENV.r2AccessKeyId;
  const secretAccessKey = ENV.r2SecretAccessKey;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Cloudflare R2 credentials missing. Please set:\n" +
      "  R2_ACCOUNT_ID - Your Cloudflare Account ID\n" +
      "  R2_ACCESS_KEY_ID - R2 API Token Access Key ID\n" +
      "  R2_SECRET_ACCESS_KEY - R2 API Token Secret Access Key\n" +
      "\nYou can create an R2 API Token at:\n" +
      "  Cloudflare Dashboard → R2 → Manage R2 API Tokens"
    );
  }

  s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return s3Client;
}

function getBucketName(): string {
  const bucket = ENV.r2BucketName;
  if (!bucket) {
    throw new Error("R2_BUCKET_NAME environment variable is not set");
  }
  return bucket;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

/**
 * Upload a file to Cloudflare R2
 * @param relKey - Relative path/key for the file (e.g., "receipts/42-1234567890.jpg")
 * @param data - File data as Buffer, Uint8Array, or string
 * @param contentType - MIME type of the file
 * @returns Object with key and public URL
 */
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const client = getR2Client();
  const bucket = getBucketName();
  const key = normalizeKey(relKey);

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: data,
    ContentType: contentType,
  });

  await client.send(command);

  // If public domain is configured, return the public URL
  // Otherwise return our own API proxy URL (always works, no expiry)
  const publicDomain = ENV.r2PublicDomain;
  let url: string;
  if (publicDomain) {
    url = `https://${publicDomain}/${key}`;
  } else {
    // Use our own API endpoint to serve the file
    // This always works and doesn't expire
    url = `/api/receipts/${key}`;
  }

  return { key, url };
}

/**
 * Get a download URL for a file from Cloudflare R2
 * @param relKey - Relative path/key for the file
 * @returns Object with key and download URL
 */
export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);

  const publicDomain = ENV.r2PublicDomain;
  let url: string;
  if (publicDomain) {
    url = `https://${publicDomain}/${key}`;
  } else {
    url = `/api/receipts/${key}`;
  }

  return { key, url };
}

/**
 * Get file data directly from R2 (for serving through API)
 * @param relKey - Relative path/key for the file
 * @returns Object with key, data buffer, and content type
 */
export async function storageGetBuffer(relKey: string): Promise<{ key: string; data: Buffer; contentType: string }> {
  const client = getR2Client();
  const bucket = getBucketName();
  const key = normalizeKey(relKey);

  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  const response = await client.send(command);

  if (!response.Body) {
    throw new Error(`File not found: ${key}`);
  }

  // Convert stream to buffer
  const chunks: Uint8Array[] = [];
  const stream = response.Body as any;
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  const data = Buffer.concat(chunks);

  return {
    key,
    data,
    contentType: response.ContentType || 'application/octet-stream',
  };
}

/**
 * Delete a file from Cloudflare R2
 * @param relKey - Relative path/key for the file
 */
export async function storageDelete(relKey: string): Promise<void> {
  const client = getR2Client();
  const bucket = getBucketName();
  const key = normalizeKey(relKey);

  const command = new DeleteObjectCommand({ Bucket: bucket, Key: key });
  await client.send(command);
}
