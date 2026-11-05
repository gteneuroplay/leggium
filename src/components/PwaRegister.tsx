"use client";

import { useEffect } from "react";

/** Regista `/sw.js` em HTTPS (ou localhost) para o navegador permitir «Instalar app». */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const { protocol, hostname } = window.location;
    if (protocol !== "https:" && hostname !== "localhost" && hostname !== "127.0.0.1") {
      return;
    }
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => reg.update())
      .catch(() => {});
  }, []);
  return null;
}
