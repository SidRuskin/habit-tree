import type { NextConfig } from "next";

// Get basePath from environment variable, default to empty string
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: process.env.NEXT_EXPORT === "true" ? "export" : undefined,
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  headers() {
    // Required by FHEVM
    return Promise.resolve([
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
        ],
      },
      {
        source: '/:path*.wasm',
        headers: [
          { key: 'Content-Type', value: 'application/wasm' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },
    ]);
  }
};

export default nextConfig;

