import { mkdir, unlink, writeFile } from 'fs/promises';
import { join } from 'path';

export const MAX_AVATAR_BYTES = 4 * 1024 * 1024;

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

const EXT_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
};

export function avatarUploadRoot() {
  return process.env.AVATAR_UPLOAD_DIR ?? join(process.cwd(), 'uploads', 'avatars');
}

export function resolveAvatarMime(name: string, mime: string) {
  if (mime && mime !== 'application/octet-stream' && ALLOWED_MIME.has(mime)) return mime;
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return EXT_MIME[ext] ?? mime;
}

export function isAllowedAvatarMime(mime: string) {
  return ALLOWED_MIME.has(mime);
}

export function avatarPath(storageKey: string) {
  return join(avatarUploadRoot(), storageKey);
}

export async function saveAvatar(userId: string, mime: string, buffer: Buffer) {
  const ext = MIME_EXT[mime] ?? 'jpg';
  const key = `${userId}.${ext}`;
  const full = avatarPath(key);
  await mkdir(avatarUploadRoot(), { recursive: true });
  await writeFile(full, buffer);
  return key;
}

export async function removeAvatarFile(storageKey: string) {
  try {
    await unlink(avatarPath(storageKey));
  } catch {
    // already gone
  }
}

export function logoUploadRoot() {
  return process.env.LOGO_UPLOAD_DIR ?? join(process.cwd(), 'uploads', 'logos');
}

export function logoPath(storageKey: string) {
  return join(logoUploadRoot(), storageKey);
}

export async function saveOrgLogo(organizationId: string, mime: string, buffer: Buffer) {
  const ext = MIME_EXT[mime] ?? 'png';
  const key = `${organizationId}.${ext}`;
  const full = logoPath(key);
  await mkdir(logoUploadRoot(), { recursive: true });
  await writeFile(full, buffer);
  return key;
}

export async function removeLogoFile(storageKey: string) {
  try {
    await unlink(logoPath(storageKey));
  } catch {
    // already gone
  }
}
