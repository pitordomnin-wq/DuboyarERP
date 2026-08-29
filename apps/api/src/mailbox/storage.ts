import { mkdir, unlink, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { randomBytes } from 'crypto';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 10;

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/zip',
  'application/x-zip-compressed',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

export { MAX_FILE_BYTES, MAX_FILES };

export function mailUploadRoot() {
  return process.env.MAIL_UPLOAD_DIR ?? join(process.cwd(), 'uploads', 'mail');
}

const EXT_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  pdf: 'application/pdf',
  txt: 'text/plain',
  csv: 'text/csv',
  zip: 'application/zip',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export function resolveMime(name: string, mime: string) {
  if (mime && mime !== 'application/octet-stream' && ALLOWED_MIME.has(mime)) return mime;
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return EXT_MIME[ext] ?? mime;
}

export function isAllowedMime(mime: string) {
  return ALLOWED_MIME.has(mime);
}

export function isInlineMime(mime: string) {
  return mime.startsWith('image/') || mime === 'application/pdf';
}

export function safeFileName(name: string) {
  const base = name.replace(/[/\\]/g, '').replace(/[^\w.\- ()а-яА-ЯёЁ]+/gi, '_').trim();
  return (base || 'file').slice(0, 180);
}

export async function saveMailFile(organizationId: string, originalName: string, buffer: Buffer) {
  const key = `${organizationId}/${Date.now()}-${randomBytes(6).toString('hex')}-${safeFileName(originalName)}`;
  const full = join(mailUploadRoot(), key);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, buffer);
  return key;
}

export function mailFilePath(storageKey: string) {
  return join(mailUploadRoot(), storageKey);
}

export async function removeMailFile(storageKey: string) {
  try {
    await unlink(mailFilePath(storageKey));
  } catch {
    // already gone
  }
}
