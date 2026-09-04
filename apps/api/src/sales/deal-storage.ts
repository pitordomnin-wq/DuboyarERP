import { mkdir, unlink, writeFile } from 'fs/promises';
import { dirname, join, resolve } from 'path';
import { randomBytes } from 'crypto';

export function dealUploadRoot() {
  return resolve(process.env.DEAL_UPLOAD_DIR ?? join(process.cwd(), 'uploads', 'deals'));
}

export function dealFilePath(storageKey: string) {
  return resolve(dealUploadRoot(), storageKey);
}

export async function saveDealFile(
  organizationId: string,
  originalName: string,
  buffer: Buffer,
  mimeType: string,
) {
  const safe = originalName.replace(/[/\\]/g, '').replace(/[^\w.\- ()а-яА-ЯёЁ]+/gi, '_').trim() || 'file';
  const key = `${organizationId}/${Date.now()}-${randomBytes(6).toString('hex')}-${safe.slice(0, 120)}`;
  const full = join(dealUploadRoot(), key);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, buffer);
  return { storageKey: key, mimeType, size: buffer.length };
}

export async function removeDealFile(storageKey: string) {
  try {
    await unlink(dealFilePath(storageKey));
  } catch {
    // already gone
  }
}
