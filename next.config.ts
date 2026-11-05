import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  /** Permite abrir o dev server por localhost e 127.0.0.1 sem bloqueio de assets. */
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  /** Imagem Docker menor: só dependências traçadas pelo Next. */
  output: "standalone",
  /** Uploads em `public/uploads` após o build: em produção o manifest de `public/` não inclui ficheiros novos. */
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/uploads/:path*", destination: "/api/uploads/static/:path*" },
      ],
    };
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "80mb",
    },
    /** Buffer do corpo quando há proxy — PDF em base64 pode ser grande. */
    proxyClientMaxBodySize: "80mb",
  },
};

export default nextConfig;
