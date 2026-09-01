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
  index,
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

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Activity = typeof activities.$inferSelect;
export type CmsUser = typeof cmsUsers.$inferSelect;
