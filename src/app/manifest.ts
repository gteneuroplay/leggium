import type { MetadataRoute } from "next";
import { headers } from "next/headers";

/**
 * PWA por origem (subdomínio da câmara): instalável no Chrome/Android TV
 * sem aplicação nativa — mesmo host que a sessão e os cookies.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const h = await headers();
  const hostRaw =
    h.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    h.get("host") ||
    "syslegis.com";
  const host = hostRaw.split(":")[0].toLowerCase();
  const label = host.includes(".") ? host : "SysLegis";

  return {
    name: `SysLegis — ${label}`,
    short_name: "SysLegis",
    description: "Painel legislativo e gestão da câmara (instalável como aplicação web).",
    start_url: "/painel/tv",
    scope: "/",
    display: "standalone",
    background_color: "#0f172a",
    theme_color: "#2563eb",
    orientation: "any",
    categories: ["government", "productivity"],
    icons: [
      {
        src: "/icons/pwa-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/pwa-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/pwa-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
