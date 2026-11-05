/* SysLegis PWA SW — v4
 * - /plataforma e /painel: não chamar respondWith — o pedido segue nativo (menos atrito com RSC/Server Actions).
 * - Resto: proxy com fetch; falhas tratadas para não rejeitar respondWith (evita "Uncaught (in promise)" no SW).
 */
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  let pathname = "";
  try {
    pathname = new URL(event.request.url).pathname;
  } catch {
    return;
  }
  // Sem respondWith: o browser trata o pedido (recomendado para painel em tempo real e plataforma).
  if (pathname.startsWith("/plataforma") || pathname.startsWith("/painel")) {
    return;
  }
  event.respondWith(
    fetch(event.request).catch(() => {
      return Response.error();
    })
  );
});
