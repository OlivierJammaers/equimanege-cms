CREATE TYPE "public"."crawl_candidate_status" AS ENUM('pending', 'approved', 'rejected', 'duplicate');--> statement-breakpoint
CREATE TYPE "public"."crawl_job_status" AS ENUM('pending', 'running', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."crawl_run_status" AS ENUM('pending', 'running', 'paused', 'done', 'failed');--> statement-breakpoint
CREATE TABLE "crawl_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"name" text NOT NULL,
	"gemeente" text,
	"payload" jsonb NOT NULL,
	"status" "crawl_candidate_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"account_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crawl_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"area" text NOT NULL,
	"status" "crawl_job_status" DEFAULT 'pending' NOT NULL,
	"candidates_found" integer DEFAULT 0 NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" double precision DEFAULT 0 NOT NULL,
	"error" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crawl_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country" text NOT NULL,
	"region" text NOT NULL,
	"status" "crawl_run_status" DEFAULT 'pending' NOT NULL,
	"started_by" uuid,
	"total_jobs" integer DEFAULT 0 NOT NULL,
	"done_jobs" integer DEFAULT 0 NOT NULL,
	"candidates_found" integer DEFAULT 0 NOT NULL,
	"cost_usd" double precision DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crawl_candidates" ADD CONSTRAINT "crawl_candidates_run_id_crawl_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."crawl_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crawl_candidates" ADD CONSTRAINT "crawl_candidates_job_id_crawl_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."crawl_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crawl_candidates" ADD CONSTRAINT "crawl_candidates_reviewed_by_cms_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."cms_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crawl_candidates" ADD CONSTRAINT "crawl_candidates_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crawl_jobs" ADD CONSTRAINT "crawl_jobs_run_id_crawl_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."crawl_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crawl_runs" ADD CONSTRAINT "crawl_runs_started_by_cms_users_id_fk" FOREIGN KEY ("started_by") REFERENCES "public"."cms_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "crawl_candidates_run_idx" ON "crawl_candidates" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "crawl_candidates_job_idx" ON "crawl_candidates" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "crawl_candidates_status_idx" ON "crawl_candidates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "crawl_jobs_run_idx" ON "crawl_jobs" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "crawl_jobs_status_idx" ON "crawl_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "crawl_runs_status_idx" ON "crawl_runs" USING btree ("status");