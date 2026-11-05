import { NextResponse, type NextRequest } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";

function contentType(ext: string): string {
  switch (ext.toLowerCase()) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".svg":
      return "image/svg+xml";
    case ".ico":
      return "image/x-icon";
    default:
      return "application/octet-stream";
  }
}

/** Ficheiros em `public/uploads` criados em runtime: o Next em produção não os regista no manifest de `public/`. */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path: raw } = await context.params;
  if (!raw?.length) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const segments = raw.filter((s) => s && s !== "." && s !== "..");
  if (segments.length !== raw.length) {
    return new NextResponse("Bad Request", { status: 400 });
  }

  const root = path.join(process.cwd(), "public", "uploads");
  const filePath = path.join(root, ...segments);
  const resolved = path.resolve(filePath);
  const rootResolved = path.resolve(root);
  const prefix = rootResolved.endsWith(path.sep) ? rootResolved : rootResolved + path.sep;
  if (resolved !== rootResolved && !resolved.startsWith(prefix)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const stat = await fs.stat(resolved);
    if (!stat.isFile()) {
      return new NextResponse("Not Found", { status: 404 });
    }
    const buf = await fs.readFile(resolved);
    const ext = path.extname(resolved);
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": contentType(ext),
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new NextResponse("Not Found", { status: 404 });
  }
}
