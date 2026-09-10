ALTER TYPE "public"."activity_type" ADD VALUE 'meeting';--> statement-breakpoint
CREATE TABLE "meeting_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer DEFAULT 60 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slot_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"booked_by" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meeting_slots" ADD CONSTRAINT "meeting_slots_created_by_cms_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."cms_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_slot_id_meeting_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."meeting_slots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_booked_by_cms_users_id_fk" FOREIGN KEY ("booked_by") REFERENCES "public"."cms_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meeting_slots_starts_at_idx" ON "meeting_slots" USING btree ("starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "meetings_slot_id_uq" ON "meetings" USING btree ("slot_id");--> statement-breakpoint
CREATE INDEX "meetings_account_idx" ON "meetings" USING btree ("account_id");