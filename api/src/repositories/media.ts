import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import type { Readable } from "node:stream";
import type { Config } from "../config/env.js";

export interface StoredMedia {
  body: Readable;
  contentType: string;
  contentLength: number | undefined;
}

export interface MediaRepository {
  ensureBucket(): Promise<void>;
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<StoredMedia | null>;
}

const BUCKET_ATTEMPTS = 15;
const BUCKET_RETRY_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createMediaRepository(
  config: Pick<Config, "S3_ENDPOINT" | "S3_ACCESS_KEY" | "S3_SECRET_KEY" | "S3_BUCKET">,
): MediaRepository {
  const client = new S3Client({
    endpoint: config.S3_ENDPOINT,
    region: "us-east-1",
    forcePathStyle: true,
    credentials: { accessKeyId: config.S3_ACCESS_KEY, secretAccessKey: config.S3_SECRET_KEY },
  });
  const bucket = config.S3_BUCKET;

  async function bucketExists(): Promise<boolean> {
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
      return true;
    } catch (err) {
      if (err instanceof S3ServiceException && err.$metadata.httpStatusCode === 404) {
        return false;
      }
      throw err;
    }
  }

  return {
    async ensureBucket() {
      let lastError: unknown;
      for (let attempt = 1; attempt <= BUCKET_ATTEMPTS; attempt++) {
        try {
          if (!(await bucketExists())) {
            await client.send(new CreateBucketCommand({ Bucket: bucket }));
          }
          return;
        } catch (err) {
          lastError = err;
          await sleep(BUCKET_RETRY_MS);
        }
      }
      throw lastError;
    },

    async put(key, body, contentType) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          ContentLength: body.length,
        }),
      );
    },

    async get(key) {
      try {
        const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        if (!result.Body) {
          return null;
        }
        return {
          body: result.Body as Readable,
          contentType: result.ContentType ?? "application/octet-stream",
          contentLength: result.ContentLength,
        };
      } catch (err) {
        if (err instanceof NoSuchKey) {
          return null;
        }
        throw err;
      }
    },
  };
}
