import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-guards";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Import — EquiManege CMS",
};

export default async function ImportPage() {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Import</h1>
        <p className="text-sm text-muted-foreground">
          Prospecten importeren uit de Limburg-belllijst.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Limburg-import</CardTitle>
          <CardDescription>
            Deze import draait momenteel via de command line, niet via een upload in dit scherm.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          <div>
            <p className="font-medium text-foreground">Commando</p>
            <pre className="mt-1 overflow-x-auto rounded-md border bg-muted px-3 py-2 font-mono text-xs">
              npm run import:limburg [pad-naar-html]
            </pre>
            <p className="mt-1 text-muted-foreground">
              Zonder argument gebruikt het script de standaardlocatie op de laptop van Olivier
              (Downloads-map). Geef een ander pad mee om een andere export te importeren.
            </p>
          </div>

          <div>
            <p className="font-medium text-foreground">Bron</p>
            <p className="text-muted-foreground">
              De HTML-export van de Limburg-belllijst (een <code>const DATA = [ … ]</code>
              -array met één record per manege/opfokker).
            </p>
          </div>

          <div>
            <p className="font-medium text-foreground">Wat het doet</p>
            <ul className="list-disc pl-5 text-muted-foreground">
              <li>Leest en parseert de HTML-export naar 30 bronvelden per account.</li>
              <li>
                Upsert elk record op naam + gemeente: nieuwe accounts worden toegevoegd, bekende
                accounts krijgen bijgewerkte bronvelden.
              </li>
              <li>
                Is idempotent: opnieuw draaien met dezelfde (of een bijgewerkte) export is veilig.
              </li>
              <li>
                Raakt nooit sales-voortgang aan — belstatus, volgende actiedatum, afgehandeld,
                toegewezen sales en type (prospect/klant) blijven ongewijzigd bij een update.
              </li>
              <li>Print na afloop het aantal ingevoegde en bijgewerkte accounts.</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
