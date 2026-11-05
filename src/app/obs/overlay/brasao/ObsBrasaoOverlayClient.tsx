"use client";

import { ObsTransparentChrome } from "@/components/obs/ObsTransparentChrome";

export function ObsBrasaoOverlayClient({
  brasaoUrl,
  nomeCamara,
}: {
  brasaoUrl: string | null;
  nomeCamara: string;
}) {
  return (
    <ObsTransparentChrome>
      <div className="pointer-events-none fixed right-4 top-4 z-50 flex max-w-[min(220px,40vw)] flex-col items-end gap-2 md:right-8 md:top-8 md:max-w-[280px] animate-in fade-in slide-in-from-top-2 duration-500">
        {brasaoUrl ? (
          <img
            src={brasaoUrl}
            alt={nomeCamara}
            className="max-h-20 w-auto object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.65)] md:max-h-28"
          />
        ) : (
          <div className="rounded-xl border border-white/20 bg-slate-950/80 px-4 py-2 text-right shadow-xl backdrop-blur-md">
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-300">Câmara</p>
            <p className="mt-1 max-w-[200px] text-right text-sm font-black uppercase leading-tight text-white md:text-base">
              {nomeCamara}
            </p>
          </div>
        )}
      </div>
    </ObsTransparentChrome>
  );
}
