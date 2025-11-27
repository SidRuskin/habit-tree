// Downloads the Relayer SDK UMD bundle into the public/ folder
// This script is safe to run multiple times.

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import https from 'node:https';
import { createRequire } from 'node:module';

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

async function copyFromNodeModules(dest) {
  const require = createRequire(import.meta.url);
  let pkgDir;
  try {
    const pkgJsonPath = require.resolve('@zama-fhe/relayer-sdk/package.json');
    pkgDir = path.dirname(pkgJsonPath);
  } catch {
    throw new Error('Package @zama-fhe/relayer-sdk is not installed.');
  }

  const candidates = [
    path.join(pkgDir, 'bundle', 'relayer-sdk-js.umd.cjs'),
    path.join(pkgDir, 'dist', 'relayer-sdk-js.umd.cjs'),
    path.join(pkgDir, 'umd', 'relayer-sdk-js.umd.cjs'),
  ];

  for (const src of candidates) {
    try {
      await fsp.access(src);
      await ensureDir(path.dirname(dest));
      await fsp.copyFile(src, dest);
      console.log(`[prepare] Copied UMD from node_modules -> ${dest}`);
      return;
    } catch {
      // try next candidate
    }
  }
  throw new Error('Could not find relayer-sdk-js.umd.cjs in node_modules.');
}

async function main() {
  try {
    console.log(`[prepare] Downloading Relayer SDK from ${CDN_URL} -> ${outFile}`);
    await download(CDN_URL, outFile);
    console.log('[prepare] Relayer SDK downloaded successfully.');
  } catch (err) {
    console.warn('[prepare] Failed to download Relayer SDK from CDN:', err.message);
    console.warn('[prepare] Falling back to copying from node_modules...');
    try {
      await copyFromNodeModules(outFile);
      console.log('[prepare] Fallback copy succeeded.');
    } catch (fallbackErr) {
      console.error('[prepare] Fallback copy failed:', fallbackErr.message);
      process.exitCode = 1;
    }
  }
}

await main();

