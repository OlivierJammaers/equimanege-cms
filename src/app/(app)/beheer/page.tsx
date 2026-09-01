import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-guards";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Beheer — EquiManege CMS",
};

const LINKS = [
  {
    href: "/beheer/gebruikers",
    title: "Gebruikers",
    description: "Sales- en adminaccounts aanmaken, deactiveren en wachtwoorden resetten.",
  },
  {
    href: "/beheer/import",
    title: "Import",
    description: "Prospecten importeren uit de Limburg-belllijst.",
  },
];

export default async function BeheerLandingPage() {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Beheer</h1>
        <p className="text-sm text-muted-foreground">Adminfuncties voor de CMS.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="h-full transition-colors hover:bg-accent/50">
              <CardHeader>
                <CardTitle>{link.title}</CardTitle>
                <CardDescription>{link.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
