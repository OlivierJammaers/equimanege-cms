import Image from "next/image";
import Link from "next/link";
import logo from "@/assets/logo.webp";
import { signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { SessionUser } from "@/lib/auth-guards";

export function AppHeader({
  user,
  pendingReviewCount = 0,
}: {
  user: SessionUser;
  pendingReviewCount?: number;
}) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 text-sm font-semibold tracking-tight">
          <Image
            src={logo}
            alt=""
            width={28}
            height={26}
            className="rounded-md"
          />
          <span>
            EquiManage <span className="text-muted-foreground">CRM</span>
          </span>
        </Link>

        <nav className="flex items-center gap-4 text-sm">
          <Link
            href="/"
            className="text-foreground/80 transition-colors hover:text-foreground"
          >
            Lijst
          </Link>
          <Link
            href="/klanten"
            className="text-foreground/80 transition-colors hover:text-foreground"
          >
            Klanten
          </Link>
          <Link
            href="/review"
            className="flex items-center gap-1.5 text-foreground/80 transition-colors hover:text-foreground"
          >
            Review
            {pendingReviewCount > 0 ? (
              <Badge className="h-4 min-w-4 rounded-full px-1 text-[10px] tabular-nums">
                {pendingReviewCount}
              </Badge>
            ) : null}
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
