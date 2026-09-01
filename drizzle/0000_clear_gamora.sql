CREATE TYPE "public"."account_type" AS ENUM('prospect', 'customer');--> statement-breakpoint
CREATE TYPE "public"."activity_type" AS ENUM('comment', 'call', 'status_change', 'email', 'system');--> statement-breakpoint
CREATE TYPE "public"."call_status" AS ENUM('', 'gebeld-geen-gehoor', 'gesproken-interesse', 'gesproken-geen-interesse', 'afspraak-gepland', 'demo-gegeven', 'klant', 'niet-benaderen');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('A', 'B', 'C', 'D', 'N', 'X');--> statement-breakpoint
CREATE TYPE "public"."cms_role" AS ENUM('admin', 'sales');--> statement-breakpoint
CREATE TABLE "account_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kpis" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "account_type" DEFAULT 'prospect' NOT NULL,
	"priority" "priority",
	"score" integer,
	"region" text,
	"country" text,
	"assigned_to" uuid,
	"equimanege_manege_id" integer,
	"call_status" "call_status" DEFAULT '' NOT NULL,
	"next_action_date" date,
	"is_done" boolean DEFAULT false NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"gemeente" text,
	"deelgemeente" text,
	"postcode" text,
	"address" text,
	"phone" text,
	"email" text,
	"website" text,
	"facebook" text,
	"instagram" text,
	"contact_person" text,
	"size_info" text,
	"pricing_info" text,
	"offer" text,
	"infrastructure" text,
	"disciplines" text,
	"gives_lessons" text,
	"software_status" text,
	"software_detail" text,
	"website_tech" text,
	"sales_angle" text,
	"vat_number" text,
	"source_status" text,
	"contact_score" text,
	"source_type" text,
	"source_notes" text,
	"source" text,
	"on_your_list" text,
	"opener" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"user_id" uuid,
	"type" "activity_type" NOT NULL,
	"body" text,
	"call_outcome" "call_status",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cms_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"role" "cms_role" DEFAULT 'sales' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cms_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "account_snapshots" ADD CONSTRAINT "account_snapshots_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_assigned_to_cms_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."cms_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_user_id_cms_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."cms_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_gemeente_idx" ON "accounts" USING btree ("gemeente");--> statement-breakpoint
CREATE INDEX "accounts_priority_idx" ON "accounts" USING btree ("priority");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_name_gemeente_uq" ON "accounts" USING btree ("name","gemeente");--> statement-breakpoint
CREATE INDEX "activities_account_idx" ON "activities" USING btree ("account_id");