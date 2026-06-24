#!/usr/bin/env node
import { existsSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEST = path.resolve(__dirname, '..', 'src-tauri', 'pdfium.dll');
const URL = 'https://github.com/bblanchon/pdfium-binaries/releases/download/chromium%2F7543/pdfium-win-x64.tgz';

if (existsSync(DEST)) {
  console.log('pdfium.dll already present, skipping.');
  process.exit(0);
}

console.log('Downloading pdfium build 7543...');
const res = await fetch(URL);
if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);

const tmpFile = path.join(tmpdir(), 'pdfium-win-x64.tgz');
const tmpDir  = path.join(tmpdir(), 'pdfium-extract');

writeFileSync(tmpFile, Buffer.from(await res.arrayBuffer()));
mkdirSync(tmpDir, { recursive: true });
execSync(`tar -xf "${tmpFile}" -C "${tmpDir}"`, { stdio: 'inherit' });

function findFile(dir, name) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findFile(full, name);
      if (found) return found;
    } else if (entry.name === name) {
      return full;
    }
  }
  return null;
}

const dll = findFile(tmpDir, 'pdfium.dll');
if (!dll) throw new Error('pdfium.dll not found in archive');

copyFileSync(dll, DEST);
rmSync(tmpFile, { force: true });
rmSync(tmpDir, { recursive: true, force: true });

console.log(`pdfium.dll installed → ${DEST}`);
