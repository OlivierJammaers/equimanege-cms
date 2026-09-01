import { requireUser } from "@/lib/auth-guards";
import { AppHeader } from "@/components/layout/app-header";
import { TooltipProvider } from "@/components/ui/tooltip";

// Deze layout roept requireUser() aan (sessie + DB-lookup via Auth.js) —
// nooit statisch prerenderen.
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: LayoutProps<"/">) {
  const user = await requireUser();

  return (
    <TooltipProvider delayDuration={200}>
      <AppHeader user={user} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        {children}
      </main>
    </TooltipProvider>
  );
}
