import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { db } from "@/db";
import { accounts, activities, cmsUsers } from "@/db/schema";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CallStatusSelect } from "@/components/accounts/call-status-select";
import { NextActionControls } from "@/components/accounts/next-action-controls";
import { AddCommentForm } from "@/components/accounts/add-comment-form";
import { ActivityTimeline } from "@/components/accounts/activity-timeline";
import {
  PRIORITY_BADGE_CLASSES,
  PRIORITY_LABELS,
  type CallStatus,
  type Priority,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

// Leest rechtstreeks uit de DB — nooit statisch prerenderen.
export const dynamic = "force-dynamic";

const idSchema = z.string().uuid();

function toExternalHref(value: string): string {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">{children}</CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode | null | undefined;
}) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}

export default async function AccountDetailPage({
  params,
}: PageProps<"/accounts/[id]">) {
  const { id } = await params;

  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) notFound();

  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, parsedId.data))
    .limit(1);

  if (!account) notFound();

  const activityRows = await db
    .select({
      id: activities.id,
      type: activities.type,
      body: activities.body,
      callOutcome: activities.callOutcome,
      createdAt: activities.createdAt,
      authorName: cmsUsers.name,
    })
    .from(activities)
    .leftJoin(cmsUsers, eq(activities.userId, cmsUsers.id))
    .where(eq(activities.accountId, account.id))
    .orderBy(desc(activities.createdAt));

  const addressParts = [
    account.address,
    [account.postcode, account.gemeente].filter(Boolean).join(" ").trim() ||
      null,
  ].filter((part): part is string => Boolean(part));
  const addressLine = addressParts.length > 0 ? addressParts.join(", ") : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Link
          href="/"
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Terug naar overzicht
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {account.name}
              </h1>
              {account.priority ? (
                <Badge
                  variant="outline"
                  className={cn(
                    "font-mono text-[11px] uppercase",
                    PRIORITY_BADGE_CLASSES[account.priority as Priority],
                  )}
                >
                  {account.priority}
                </Badge>
              ) : null}
              {account.score !== null ? (
                <span className="font-mono text-xs text-muted-foreground">
                  score {account.score}
                </span>
              ) : null}
              {account.isDone ? (
                <Badge variant="secondary" className="text-[11px]">
                  Afgehandeld
                </Badge>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">
              {[account.gemeente, account.category].filter(Boolean).join(" · ") ||
                "—"}
              {account.priority ? (
                <span className="ml-2 text-xs text-muted-foreground/80">
                  {PRIORITY_LABELS[account.priority as Priority]}
                </span>
              ) : null}
            </p>
          </div>

          <div className="min-w-[11rem]">
            <CallStatusSelect
              accountId={account.id}
              value={account.callStatus as CallStatus}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-6">
          <SectionCard title="Contact">
            <Field label="Adres" value={addressLine} />
            <Field label="Deelgemeente" value={account.deelgemeente} />
            <Field label="Contactpersoon" value={account.contactPerson} />
            <Field
              label="Telefoon"
              value={
                account.phone ? (
                  <a
                    href={`tel:${account.phone}`}
                    className="font-mono underline-offset-2 hover:underline"
                  >
                    {account.phone}
                  </a>
                ) : null
              }
            />
            <Field
              label="E-mail"
              value={
                account.email ? (
                  <a
                    href={`mailto:${account.email}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {account.email}
                  </a>
                ) : null
              }
            />
            <Field
              label="Website"
              value={
                account.website ? (
                  <a
                    href={toExternalHref(account.website)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline-offset-2 hover:underline"
                  >
                    {account.website}
                  </a>
                ) : null
              }
            />
            <Field
              label="Facebook"
              value={
                account.facebook ? (
                  <a
                    href={toExternalHref(account.facebook)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline-offset-2 hover:underline"
                  >
                    {account.facebook}
                  </a>
                ) : null
              }
            />
            <Field
              label="Instagram"
              value={
                account.instagram ? (
                  <a
                    href={toExternalHref(account.instagram)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline-offset-2 hover:underline"
                  >
                    {account.instagram}
                  </a>
                ) : null
              }
            />
          </SectionCard>

          <SectionCard title="Omvang & tarieven">
            <Field label="Omvang" value={account.sizeInfo} />
            <Field label="Tarieven" value={account.pricingInfo} />
          </SectionCard>

          <SectionCard title="Aanbod & infrastructuur">
            <Field label="Aanbod" value={account.offer} />
            <Field label="Infrastructuur" value={account.infrastructure} />
            <Field label="Disciplines" value={account.disciplines} />
            <Field label="Geeft lessen" value={account.givesLessons} />
          </SectionCard>

          <SectionCard title="Software">
            <Field label="Status" value={account.softwareStatus} />
            <Field label="Detail" value={account.softwareDetail} />
            <Field label="Websitetechnologie" value={account.websiteTech} />
          </SectionCard>

          <Card>
            <CardHeader>
              <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Verkoophoek & opener
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {account.salesAngle ? (
                <p className="text-sm text-foreground">{account.salesAngle}</p>
              ) : null}
              {account.opener ? (
                <div className="rounded-md border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-600 dark:bg-amber-950/30 dark:text-amber-200">
                  {account.opener}
                </div>
              ) : null}
              {!account.salesAngle && !account.opener ? (
                <p className="text-sm text-muted-foreground">
                  Geen verkoopinformatie beschikbaar.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <SectionCard title="Herkomst">
            <Field label="Bron" value={account.source} />
            <Field label="Brontype" value={account.sourceType} />
            <Field label="Bronstatus" value={account.sourceStatus} />
            <Field label="Contactscore" value={account.contactScore} />
            <Field label="Op jouw lijst" value={account.onYourList} />
            <Field label="BTW-nummer" value={account.vatNumber} />
            <Field label="Bronnotities" value={account.sourceNotes} />
          </SectionCard>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Opvolging
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <NextActionControls
                accountId={account.id}
                nextActionDate={account.nextActionDate}
                isDone={account.isDone}
                type={account.type}
              />
              <div className="border-t pt-4">
                <AddCommentForm accountId={account.id} />
              </div>
              <div className="border-t pt-4">
                <ActivityTimeline activities={activityRows} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
