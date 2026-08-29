import { mkdir, unlink, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { randomBytes } from 'crypto';
import { safeFileName } from '../mailbox/storage';

export {
  MAX_FILE_BYTES,
  MAX_FILES,
  isAllowedMime,
  isInlineMime,
  resolveMime,
  safeFileName,
} from '../mailbox/storage';

export function taskUploadRoot() {
  return process.env.TASK_UPLOAD_DIR ?? join(process.cwd(), 'uploads', 'tasks');
}

export async function saveTaskFile(organizationId: string, originalName: string, buffer: Buffer) {
  const key = `${organizationId}/${Date.now()}-${randomBytes(6).toString('hex')}-${safeFileName(originalName)}`;
  const full = join(taskUploadRoot(), key);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, buffer);
  return key;
}

export function taskFilePath(storageKey: string) {
  return join(taskUploadRoot(), storageKey);
}

export async function removeTaskFile(storageKey: string) {
  try {
    await unlink(taskFilePath(storageKey));
  } catch {
    // already gone
  }
}
