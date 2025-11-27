// Downloads the Relayer SDK UMD bundle into the public/ folder
// This script is safe to run multiple times.

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import https from 'node:https';

const CDN_URL = 'https://cdn.zama.org/relayer-sdk-js/0.3.0-5/relayer-sdk-js.umd.cjs';
const outDir = path.join(process.cwd(), 'public');
const outFile = path.join(outDir, 'relayer-sdk-js.umd.cjs');

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

async function download(url, dest) {
  await ensureDir(path.dirname(dest));
  await new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode} during download: ${url}`));
          return;
        }
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
      })
      .on('error', (err) => {
        fs.unlink(dest, () => reject(err));
      });
  });
}

async function main() {
  try {
    console.log(`[prepare] Downloading Relayer SDK from ${CDN_URL} -> ${outFile}`);
    await download(CDN_URL, outFile);
    console.log('[prepare] Relayer SDK downloaded successfully.');
  } catch (err) {
    console.error('[prepare] Failed to download Relayer SDK:', err.message);
    process.exitCode = 1;
  }
}

await main();

