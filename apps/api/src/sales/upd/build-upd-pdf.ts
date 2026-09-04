import { mkdtemp, readFile, rm, writeFile, access } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { pathToFileURL } from 'url';

function libreOfficePath() {
  const candidates = [
    process.env.LIBREOFFICE_PATH,
    '/Applications/LibreOffice.app/Contents/MacOS/soffice',
    '/usr/local/bin/soffice',
    '/opt/homebrew/bin/soffice',
    '/usr/bin/soffice',
    '/usr/bin/libreoffice',
  ].filter(Boolean) as string[];
  return candidates.find((path) => existsSync(path)) ?? null;
}

function run(bin: string, args: string[], cwd?: string, timeoutMs = 120_000) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(bin, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('libreoffice_timeout'));
    }, timeoutMs);
    child.stderr.on('data', (chunk: Buffer) => {
      err += chunk.toString();
    });
    child.stdout.on('data', (chunk: Buffer) => {
      err += chunk.toString();
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(err.trim() || `libreoffice_exit_${code}`));
    });
  });
}

/**
 * Convert filled official UPD blank (xlsx) to PDF via LibreOffice.
 * This keeps the legal form layout; do not fall back to a simplified HTML PDF.
 */
export async function buildUpdPdf(_input: unknown, xlsx?: Buffer): Promise<Buffer> {
  if (!xlsx?.length) {
    throw new Error('upd_xlsx_required');
  }
  const soffice = libreOfficePath();
  if (!soffice) {
    throw new Error('libreoffice_missing');
  }

  const dir = await mkdtemp(join(tmpdir(), 'upd-lo-'));
  const profile = join(dir, 'profile');
  const xlsxPath = join(dir, 'upd.xlsx');
  const pdfPath = join(dir, 'upd.pdf');
  try {
    await writeFile(xlsxPath, xlsx);
    await run(
      soffice,
      [
        `-env:UserInstallation=${pathToFileURL(profile).href}`,
        '--headless',
        '--nologo',
        '--nofirststartwizard',
        '--norestore',
        '--convert-to',
        'pdf:calc_pdf_Export',
        '--outdir',
        dir,
        xlsxPath,
      ],
      dir,
    );
    await access(pdfPath);
    return await readFile(pdfPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
