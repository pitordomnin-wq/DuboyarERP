import { mkdir, stat, unlink, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { randomBytes } from 'crypto';
import sharp from 'sharp';

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_IMAGES = 8;

/** Cap the largest image dimension on ingest — anything above this is wasteful for a CRM. */
const INGEST_MAX_EDGE = 2048;
/** Widths we're willing to generate on demand. Anything else falls back to the nearest allowed size. */
const ALLOWED_WIDTHS = [96, 192, 240, 320, 480, 640, 800, 1200, 1600] as const;

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

function cacheRoot() {
  return join(productUploadRoot(), '_cache');
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

function stripExt(name: string) {
  return name.replace(/\.[^./\\]+$/, '');
}

/** Save an uploaded image, resizing to a sane max edge and re-encoding to WebP. */
export async function saveProductImage(organizationId: string, originalName: string, buffer: Buffer) {
  const stem = stripExt(safeFileName(originalName));
  const key = `${organizationId}/${Date.now()}-${randomBytes(6).toString('hex')}-${stem}.webp`;
  const full = join(productUploadRoot(), key);
  await mkdir(dirname(full), { recursive: true });

  const pipeline = sharp(buffer, { failOn: 'none' })
    .rotate()
    .resize({
      width: INGEST_MAX_EDGE,
      height: INGEST_MAX_EDGE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 82, effort: 4 });

  const data = await pipeline.toBuffer();
  await writeFile(full, data);
  return { storageKey: key, mimeType: 'image/webp', size: data.length };
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

function snapWidth(raw: number): number | null {
  if (!Number.isFinite(raw) || raw <= 0) return null;
  // Pick the smallest allowed width that's >= requested; anything above the largest → skip resize.
  for (const w of ALLOWED_WIDTHS) {
    if (w >= raw) return w;
  }
  return null;
}

/**
 * Return an on-disk file that satisfies the requested width, generating a cached WebP variant
 * next to the original when needed. If width can't be satisfied (>= largest allowed), returns the source.
 */
export async function resolveResizedImage(
  storageKey: string,
  width: number,
  sourceMime: string,
): Promise<{ path: string; mimeType: string }> {
  const original = productImagePath(storageKey);
  const target = snapWidth(width);
  if (!target) return { path: original, mimeType: sourceMime };

  const cachePath = join(cacheRoot(), `${storageKey}@w${target}.webp`);
  try {
    await stat(cachePath);
    return { path: cachePath, mimeType: 'image/webp' };
  } catch {
    // need to generate
  }

  await mkdir(dirname(cachePath), { recursive: true });
  await sharp(original, { failOn: 'none' })
    .rotate()
    .resize({ width: target, withoutEnlargement: true })
    .webp({ quality: 80, effort: 4 })
    .toFile(cachePath);
  return { path: cachePath, mimeType: 'image/webp' };
}
