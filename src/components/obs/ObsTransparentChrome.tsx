"use client";

import { useEffect } from "react";

/** Fundo transparente para Fonte de navegador no OBS (corpo/html do app são opacos por defeito). */
export function ObsTransparentChrome({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.background;
    const prevBody = body.style.background;
    const prevBodyMinH = body.style.minHeight;
    html.style.background = "transparent";
    body.style.background = "transparent";
    body.style.minHeight = "100vh";
    return () => {
      html.style.background = prevHtml;
      body.style.background = prevBody;
      body.style.minHeight = prevBodyMinH;
    };
  }, []);

  return <>{children}</>;
}
