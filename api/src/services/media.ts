import { randomUUID } from "node:crypto";
import type { MediaRepository, StoredMedia } from "../repositories/media.js";

export const MAX_MEDIA_BYTES = 5 * 1024 * 1024;

export const MEDIA_TYPES = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
} as const;

export type MediaType = keyof typeof MEDIA_TYPES;

export const MEDIA_MIME_TYPES = Object.keys(MEDIA_TYPES) as MediaType[];

const KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|gif|webp)$/;

export class InvalidMediaError extends Error {
  constructor() {
    super("invalid_media");
  }
}

export class MediaNotFoundError extends Error {
  constructor() {
    super("not_found");
  }
}

function startsWith(buffer: Buffer, bytes: number[], offset = 0): boolean {
  return buffer.length >= offset + bytes.length && bytes.every((byte, i) => buffer[offset + i] === byte);
}

export function detectMediaType(buffer: Buffer): MediaType | null {
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(buffer, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) || startsWith(buffer, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])) {
    return "image/gif";
  }
  if (startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) && startsWith(buffer, [0x57, 0x45, 0x42, 0x50], 8)) {
    return "image/webp";
  }
  return null;
}

export function createMediaService(media: MediaRepository) {
  return {
    ensureStorage(): Promise<void> {
      return media.ensureBucket();
    },

    async upload(declaredType: string, content: Buffer): Promise<{ key: string; url: string; contentType: MediaType; size: number }> {
      if (content.length === 0 || content.length > MAX_MEDIA_BYTES) {
        throw new InvalidMediaError();
      }
      const detected = detectMediaType(content);
      if (detected === null || detected !== declaredType) {
        throw new InvalidMediaError();
      }
      const key = `${randomUUID()}.${MEDIA_TYPES[detected]}`;
      await media.put(key, content, detected);
      return { key, url: `/media/${key}`, contentType: detected, size: content.length };
    },

    async download(key: string): Promise<StoredMedia> {
      if (!KEY_PATTERN.test(key)) {
        throw new MediaNotFoundError();
      }
      const stored = await media.get(key);
      if (stored === null) {
        throw new MediaNotFoundError();
      }
      return stored;
    },
  };
}

export type MediaService = ReturnType<typeof createMediaService>;
