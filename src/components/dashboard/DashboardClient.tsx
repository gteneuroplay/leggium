"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LayoutDashboard, Video } from "lucide-react";
import { cn } from "@/lib/utils";

type TabId = "inicio" | "obs";

export function DashboardClient({
  overview,
  obsPanel,
  showObsTab = true,
}: {
  overview: ReactNode;
  obsPanel: ReactNode;
  showObsTab?: boolean;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const urlWantsObs = searchParams.get("tab") === "obs";
  const initialTab: TabId = urlWantsObs && showObsTab ? "obs" : "inicio";
  const [tab, setTab] = useState<TabId>(initialTab);

  useEffect(() => {
    if (!showObsTab && urlWantsObs) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("tab");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      setTab("inicio");
      return;
    }
    const q = searchParams.get("tab") === "obs" && showObsTab ? "obs" : "inicio";
    setTab(q);
  }, [searchParams, showObsTab, urlWantsObs, pathname, router]);

  const selectTab = useCallback(
    (next: TabId) => {
      if (next === "obs" && !showObsTab) return;
      setTab(next);
      const params = new URLSearchParams(searchParams.toString());
      if (next === "obs") params.set("tab", "obs");
      else params.delete("tab");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams, showObsTab],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="sl-seg">
        <button
          type="button"
          onClick={() => selectTab("inicio")}
          className={cn("sl-seg-btn", tab === "inicio" && "active")}
        >
          <LayoutDashboard className="h-4 w-4" />
          Início
        </button>
        {showObsTab ? (
          <button
            type="button"
            onClick={() => selectTab("obs")}
            className={cn("sl-seg-btn", tab === "obs" && "active")}
          >
            <Video className="h-4 w-4" />
            OBS
          </button>
        ) : null}
      </div>

      {tab === "inicio" ? overview : showObsTab ? obsPanel : overview}
    </div>
  );
}
