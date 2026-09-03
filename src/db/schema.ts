import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  date,
  jsonb,
  doublePrecision,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("cms_role", ["admin", "sales"]);
export const accountTypeEnum = pgEnum("account_type", ["prospect", "customer"]);
export const priorityEnum = pgEnum("priority", ["A", "B", "C", "D", "N", "X"]);
export const callStatusEnum = pgEnum("call_status", [
  "",
  "gebeld-geen-gehoor",
  "gesproken-interesse",
  "gesproken-geen-interesse",
  "afspraak-gepland",
  "demo-gegeven",
  "klant",
  "niet-benaderen",
]);
export const activityTypeEnum = pgEnum("activity_type", [
  "comment",
  "call",
  "status_change",
  "email",
  "system",
]);

// AI-crawlpijplijn (fase 3) — zie
// docs/superpowers/plans/2026-09-03-fase3-ai-crawl.md
export const crawlRunStatusEnum = pgEnum("crawl_run_status", [
  "pending",
  "running",
  "paused",
  "done",
  "failed",
]);
export const crawlJobStatusEnum = pgEnum("crawl_job_status", [
  "pending",
  "running",
  "done",
  "failed",
]);
export const crawlCandidateStatusEnum = pgEnum("crawl_candidate_status", [
  "pending",
  "approved",
  "rejected",
  "duplicate",
]);

export const cmsUsers = pgTable("cms_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: roleEnum("role").notNull().default("sales"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: accountTypeEnum("type").notNull().default("prospect"),
    priority: priorityEnum("priority"),
    score: integer("score"),
    region: text("region"),
    country: text("country"),
    assignedTo: uuid("assigned_to").references(() => cmsUsers.id),
    equimanegeManegeId: integer("equimanege_manege_id"),
    callStatus: callStatusEnum("call_status").notNull().default(""),
    nextActionDate: date("next_action_date"),
    isDone: boolean("is_done").notNull().default(false),
    // bronvelden
    name: text("name").notNull(),
    category: text("category"),
    gemeente: text("gemeente"),
    deelgemeente: text("deelgemeente"),
    postcode: text("postcode"),
    address: text("address"),
    phone: text("phone"),
    email: text("email"),
    website: text("website"),
    facebook: text("facebook"),
    instagram: text("instagram"),
    contactPerson: text("contact_person"),
    sizeInfo: text("size_info"),
    pricingInfo: text("pricing_info"),
    offer: text("offer"),
    infrastructure: text("infrastructure"),
    disciplines: text("disciplines"),
    givesLessons: text("gives_lessons"),
    softwareStatus: text("software_status"),
    softwareDetail: text("software_detail"),
    websiteTech: text("website_tech"),
    salesAngle: text("sales_angle"),
    vatNumber: text("vat_number"),
    sourceStatus: text("source_status"),
    contactScore: text("contact_score"),
    sourceType: text("source_type"),
    sourceNotes: text("source_notes"),
    source: text("source"),
    onYourList: text("on_your_list"),
    opener: text("opener"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    gemeenteIdx: index("accounts_gemeente_idx").on(t.gemeente),
    priorityIdx: index("accounts_priority_idx").on(t.priority),
    // Conflict-target voor de idempotente Limburg-import-upsert
    // (src/scripts/run-import-limburg.ts).
    nameGemeenteUq: uniqueIndex("accounts_name_gemeente_uq").on(t.name, t.gemeente),
  }),
);

export const activities = pgTable(
  "activities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => cmsUsers.id),
    type: activityTypeEnum("type").notNull(),
    body: text("body"),
    callOutcome: callStatusEnum("call_outcome"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ accIdx: index("activities_account_idx").on(t.accountId) }),
);

export const accountSnapshots = pgTable("account_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
  kpis: jsonb("kpis").notNull(),
});

/**
 * Eén record per gestart AI-onderzoek (land + regio). Een discovery-stap
 * splitst de regio in deelgebieden (`crawlJobs`); elke job levert
 * kandidaten op (`crawlCandidates`). `error` wordt gezet bij `cancelRun`
 * ("Geannuleerd") en bij onherstelbare run-fouten.
 */
export const crawlRuns = pgTable(
  "crawl_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    country: text("country").notNull(),
    region: text("region").notNull(),
    status: crawlRunStatusEnum("status").notNull().default("pending"),
    startedBy: uuid("started_by").references(() => cmsUsers.id),
    totalJobs: integer("total_jobs").notNull().default(0),
    doneJobs: integer("done_jobs").notNull().default(0),
    candidatesFound: integer("candidates_found").notNull().default(0),
    costUsd: doublePrecision("cost_usd").notNull().default(0),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ statusIdx: index("crawl_runs_status_idx").on(t.status) }),
);

/**
 * Eén Claude-call per deelgebied (of de discovery-call zelf, area
 * `"__discovery__"`). `startedAt`/`finishedAt` blijven leeg tot de job
 * effectief loopt/klaar is.
 */
export const crawlJobs = pgTable(
  "crawl_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => crawlRuns.id, { onDelete: "cascade" }),
    area: text("area").notNull(),
    status: crawlJobStatusEnum("status").notNull().default("pending"),
    candidatesFound: integer("candidates_found").notNull().default(0),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costUsd: doublePrecision("cost_usd").notNull().default(0),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    runIdx: index("crawl_jobs_run_idx").on(t.runId),
    statusIdx: index("crawl_jobs_status_idx").on(t.status),
  }),
);

/**
 * Eén kandidaat-prospect uit een crawl-job. `payload` bevat de volledige
 * account-veldenset (incl. priority/score/opener) als jsonb, gespiegeld op
 * `crawlCandidateSchema` (src/lib/crawl-schema.ts). `accountId` wordt gezet
 * bij goedkeuring; `status` is `duplicate` wanneer (naam, gemeente) al
 * bestaat in `accounts` of eerder in dezelfde run.
 */
export const crawlCandidates = pgTable(
  "crawl_candidates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => crawlRuns.id, { onDelete: "cascade" }),
    jobId: uuid("job_id")
      .notNull()
      .references(() => crawlJobs.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    gemeente: text("gemeente"),
    payload: jsonb("payload").notNull(),
    status: crawlCandidateStatusEnum("status").notNull().default("pending"),
    reviewedBy: uuid("reviewed_by").references(() => cmsUsers.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    accountId: uuid("account_id").references(() => accounts.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    runIdx: index("crawl_candidates_run_idx").on(t.runId),
    jobIdx: index("crawl_candidates_job_idx").on(t.jobId),
    statusIdx: index("crawl_candidates_status_idx").on(t.status),
  }),
);

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;
export type CmsUser = typeof cmsUsers.$inferSelect;
export type CrawlRun = typeof crawlRuns.$inferSelect;
export type NewCrawlRun = typeof crawlRuns.$inferInsert;
export type CrawlJob = typeof crawlJobs.$inferSelect;
export type NewCrawlJob = typeof crawlJobs.$inferInsert;
export type CrawlCandidateRow = typeof crawlCandidates.$inferSelect;
export type NewCrawlCandidateRow = typeof crawlCandidates.$inferInsert;
