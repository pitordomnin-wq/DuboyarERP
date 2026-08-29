import { mkdir, unlink, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { randomBytes } from 'crypto';

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_IMAGES = 8;

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

const EXT_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
};

export function productUploadRoot() {
  return process.env.PRODUCT_UPLOAD_DIR ?? join(process.cwd(), 'uploads', 'products');
}

export function resolveImageMime(name: string, mime: string) {
  if (mime && mime !== 'application/octet-stream' && ALLOWED_MIME.has(mime)) return mime;
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return EXT_MIME[ext] ?? mime;
}

export function isAllowedImageMime(mime: string) {
  return ALLOWED_MIME.has(mime);
}

function safeFileName(name: string) {
  const base = name.replace(/[/\\]/g, '').replace(/[^\w.\- ()а-яА-ЯёЁ]+/gi, '_').trim();
  return (base || 'image').slice(0, 180);
}

export async function saveProductImage(organizationId: string, originalName: string, buffer: Buffer) {
  const key = `${organizationId}/${Date.now()}-${randomBytes(6).toString('hex')}-${safeFileName(originalName)}`;
  const full = join(productUploadRoot(), key);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, buffer);
  return key;
}

export function productImagePath(storageKey: string) {
  return join(productUploadRoot(), storageKey);
}

export async function removeProductImageFile(storageKey: string) {
  try {
    await unlink(productImagePath(storageKey));
  } catch {
    // already gone
  }
}
