import Link from "next/link";
import { signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import type { SessionUser } from "@/lib/auth-guards";

export function AppHeader({ user }: { user: SessionUser }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          EquiManage <span className="text-muted-foreground">CMS</span>
        </Link>

        <nav className="flex items-center gap-4 text-sm">
          <Link
            href="/"
            className="text-foreground/80 transition-colors hover:text-foreground"
          >
            Lijst
          </Link>
          {user.role === "admin" ? (
            <Link
              href="/beheer"
              className="text-foreground/80 transition-colors hover:text-foreground"
            >
              Beheer
            </Link>
          ) : null}
        </nav>

        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">{user.name}</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <Button type="submit" variant="outline" size="sm">
              Uitloggen
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
