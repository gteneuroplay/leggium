import { getCurrentUser } from "@/lib/dal";
import { cn } from "@/lib/utils";
import { AppChrome } from "./AppChrome";

interface AppLayoutProps {
  children: React.ReactNode;
  hideSidebar?: boolean;
}

export async function AppLayout({ children, hideSidebar = false }: AppLayoutProps) {
  const user = await getCurrentUser();

  if (!hideSidebar) {
    return (
      <AppChrome user={user}>
        {children}
      </AppChrome>
    );
  }

  return (
    <div className="flex h-[100dvh] min-h-0 w-full max-w-[100vw] overflow-hidden bg-background text-foreground">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden focus:outline-none">
          <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", "p-0")}>{children}</div>
        </main>
      </div>
    </div>
  );
}
