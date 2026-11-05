"use client";

import { Suspense, useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { cn } from "@/lib/utils";

export function AppChrome({
  user,
  children,
  masterPlataformaHref = "/plataforma",
}: {
  user: any;
  children: React.ReactNode;
  /** Em `slug.APP_BASE_DOMAIN`, link absoluto para o apex evita fetch RSC cross-host. */
  masterPlataformaHref?: string;
}) {
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => {
      if (mq.matches) setNavOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (navOpen) document.documentElement.classList.add("overflow-hidden");
    else document.documentElement.classList.remove("overflow-hidden");
    return () => document.documentElement.classList.remove("overflow-hidden");
  }, [navOpen]);

  return (
    <div className="flex h-[100dvh] min-h-0 w-full max-w-[100vw] overflow-hidden bg-background text-foreground">
      <div
        role="presentation"
        className={cn(
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] transition-opacity md:hidden",
          navOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setNavOpen(false)}
        aria-hidden
      />
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-[100dvh] w-[min(18rem,88vw)] max-w-[min(18rem,88vw)] shrink-0 flex-col border-r shadow-2xl transition-transform duration-200 ease-out md:static md:z-20 md:h-auto md:w-[var(--sl-rail-w)] md:max-w-[var(--sl-rail-w)] md:translate-x-0 md:shadow-none",
          navOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
        style={{ borderColor: "var(--sl-border-faint)" }}
      >
        <Suspense fallback={<div className="h-full w-full" style={{ background: "var(--sl-bg-rail)" }} aria-hidden />}>
          <Sidebar user={user} onNavigate={() => setNavOpen(false)} />
        </Suspense>
      </div>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header user={user} masterPlataformaHref={masterPlataformaHref} onOpenNav={() => setNavOpen(true)} />
        <main className="custom-scrollbar relative z-0 min-h-0 flex-1 overflow-y-auto overflow-x-hidden focus:outline-none">
          <div className="mx-auto w-full min-w-0 max-w-[1500px] px-5 py-8 sm:px-8 sm:py-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
