// Copies required WASM files from @zama-fhe/relayer-sdk into public/
// This script is safe to run multiple times.

import fs from 'node:fs/promises';
import path from 'node:path';

const srcDir = path.join(process.cwd(), 'node_modules', '@zama-fhe', 'relayer-sdk', 'dist');
const outDir = path.join(process.cwd(), 'public');
const files = ['tfhe_bg.wasm', 'kms_lib_bg.wasm'];

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function copyFileSafe(src, dest) {
  try {
    await fs.copyFile(src, dest);
    console.log(`[prepare] Copied ${path.basename(src)} -> ${dest}`);
  } catch (err) {
    console.warn(`[prepare] Failed to copy ${src}: ${err.message}`);
  }
}

async function main() {
  await ensureDir(outDir);
  await Promise.all(
    files.map((f) => copyFileSafe(path.join(srcDir, f), path.join(outDir, f)))
  );
}

await main();

