import { count, eq } from "drizzle-orm";
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
  // zichtbaar, niet alleen admins. Final-review fix 6: count()-aggregaat
  // i.p.v. alle rijen ophalen en `.length` nemen — deze layout omvat élke
  // pagina (incl. `/review` zelf), dus dit liep op elke navigatie mee.
  const [{ n: pendingReviewCount }] = await db
    .select({ n: count() })
    .from(crawlCandidates)
    .where(eq(crawlCandidates.status, "pending"));

  return (
    <TooltipProvider delayDuration={200}>
      <AppHeader user={user} pendingReviewCount={pendingReviewCount} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        {children}
      </main>
    </TooltipProvider>
  );
}
