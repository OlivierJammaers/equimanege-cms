"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Link2, Loader2, Unlink } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  listEquimanegeTenants,
  linkAccountToTenant,
  unlinkAccountFromTenant,
  type EquimanegeTenantOption,
} from "@/server/actions/kpi-link";
import { suggestTenantMatches } from "@/lib/tenant-match";

export function EquimanegeLinkCard({
  accountId,
  accountName,
  equimanegeManegeId,
}: {
  accountId: string;
  accountName: string;
  equimanegeManegeId: number | null;
}) {
  const [linkedId, setLinkedId] = useState(equimanegeManegeId);
  const [linkedName, setLinkedName] = useState<string | null>(null);

  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [unlinkDialogOpen, setUnlinkDialogOpen] = useState(false);

  const [tenants, setTenants] = useState<EquimanegeTenantOption[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, startLoadTransition] = useTransition();
  const [isLinking, startLinkTransition] = useTransition();
  const [isUnlinking, startUnlinkTransition] = useTransition();

  const suggestions = useMemo(() => {
    if (!tenants || tenants.length === 0) return [];
    const ranked = suggestTenantMatches(
      accountName,
      tenants.map((t) => ({ id: t.id, name: t.name, company_name: t.companyName })),
    );
    const byId = new Map(tenants.map((t) => [t.id, t]));
    return ranked
      .map((match) => byId.get(match.id))
      .filter((t): t is EquimanegeTenantOption => Boolean(t));
  }, [tenants, accountName]);

  const suggestionIds = useMemo(() => new Set(suggestions.map((t) => t.id)), [suggestions]);
  const otherTenants = useMemo(
    () => (tenants ?? []).filter((t) => !suggestionIds.has(t.id)),
    [tenants, suggestionIds],
  );

  function handleOpenLinkDialog(open: boolean) {
    setLinkDialogOpen(open);
    if (open && tenants === null && !isLoading) {
      setLoadError(null);
      startLoadTransition(async () => {
        try {
          const result = await listEquimanegeTenants();
          setTenants(result);
        } catch (error) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Ophalen van EquiManage-tenants mislukt.",
          );
        }
      });
    }
  }

  function handleSelectTenant(tenant: EquimanegeTenantOption) {
    startLinkTransition(async () => {
      try {
        await linkAccountToTenant(accountId, tenant.id, tenant.name);
        setLinkedId(tenant.id);
        setLinkedName(tenant.name);
        setLinkDialogOpen(false);
        toast.success(`Gekoppeld aan «${tenant.name}»`);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Koppelen mislukt",
        );
      }
    });
  }

  function handleUnlink() {
    startUnlinkTransition(async () => {
      try {
        await unlinkAccountFromTenant(accountId);
        setLinkedId(null);
        setLinkedName(null);
        setUnlinkDialogOpen(false);
        toast.success("Koppeling verwijderd");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Ontkoppelen mislukt",
        );
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          EquiManage-koppeling
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {linkedId !== null ? (
          <>
            <p className="text-sm text-foreground">
              Gekoppeld aan tenant{" "}
              <span className="font-mono text-xs text-muted-foreground">
                #{linkedId}
              </span>
              {linkedName ? ` — ${linkedName}` : ""}
            </p>
            <Dialog open={unlinkDialogOpen} onOpenChange={setUnlinkDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit"
                >
                  <Unlink className="size-3.5" />
                  Ontkoppelen
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Koppeling verwijderen?</DialogTitle>
                  <DialogDescription>
                    Dit account wordt losgekoppeld van de EquiManage-tenant. Het
                    account blijft klant; er wordt geen KPI-data meer
                    gesynchroniseerd.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setUnlinkDialogOpen(false)}
                    disabled={isUnlinking}
                  >
                    Annuleren
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleUnlink}
                    disabled={isUnlinking}
                  >
                    {isUnlinking ? "Bezig…" : "Ontkoppelen"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Nog niet gekoppeld aan een EquiManage-tenant.
            </p>
            <Dialog open={linkDialogOpen} onOpenChange={handleOpenLinkDialog}>
              <DialogTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="w-fit">
                  <Link2 className="size-3.5" />
                  Koppelen
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Koppelen aan EquiManage-tenant</DialogTitle>
                  <DialogDescription>
                    Kies de manege/tenant die bij dit account hoort.
                  </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Tenants ophalen…
                  </div>
                ) : loadError ? (
                  <p className="py-4 text-sm text-destructive">{loadError}</p>
                ) : tenants && tenants.length === 0 ? (
                  <p className="py-4 text-sm text-muted-foreground">
                    Geen tenants gevonden bij EquiManage.
                  </p>
                ) : (
                  <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
                    {suggestions.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                          Suggesties
                        </p>
                        <TenantList
                          tenants={suggestions}
                          onSelect={handleSelectTenant}
                          disabled={isLinking}
                        />
                      </div>
                    ) : null}
                    <div className="flex flex-col gap-2">
                      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        Alle tenants
                      </p>
                      <TenantList
                        tenants={otherTenants}
                        onSelect={handleSelectTenant}
                        disabled={isLinking}
                      />
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function TenantList({
  tenants,
  onSelect,
  disabled,
}: {
  tenants: EquimanegeTenantOption[];
  onSelect: (tenant: EquimanegeTenantOption) => void;
  disabled: boolean;
}) {
  if (tenants.length === 0) {
    return <p className="text-sm text-muted-foreground">Geen resultaten.</p>;
  }

  return (
    <ul className="flex flex-col gap-1">
      {tenants.map((tenant) => (
        <li key={tenant.id}>
          <button
            type="button"
            onClick={() => onSelect(tenant)}
            disabled={disabled}
            className="flex w-full flex-col items-start gap-0.5 rounded-md border border-transparent px-2 py-1.5 text-left transition-colors hover:border-border hover:bg-accent disabled:pointer-events-none disabled:opacity-60"
          >
            <span className="text-sm text-foreground">
              {tenant.companyName || tenant.name}
            </span>
            <span className="text-xs text-muted-foreground">
              {tenant.name !== tenant.companyName ? `${tenant.name} · ` : ""}
              {tenant.email}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
