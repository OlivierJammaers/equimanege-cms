import { eq } from "drizzle-orm";
import { db } from "@/db";
import { crawlCandidates } from "@/db/schema";
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

  // Badge-teller op de "Review"-navlink (fase 3) — voor alle gebruikers
  // zichtbaar, niet alleen admins.
  const pendingCandidates = await db
    .select({ id: crawlCandidates.id })
    .from(crawlCandidates)
    .where(eq(crawlCandidates.status, "pending"));

  return (
    <TooltipProvider delayDuration={200}>
      <AppHeader user={user} pendingReviewCount={pendingCandidates.length} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        {children}
      </main>
    </TooltipProvider>
  );
}
