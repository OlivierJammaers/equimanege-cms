CREATE TABLE "availability_windows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meeting_slots" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- "DROP TABLE ... CASCADE" ruimt de FK "meetings_slot_id_meeting_slots_id_fk"
-- op meetings automatisch mee op — een aparte "ALTER TABLE meetings DROP
-- CONSTRAINT" ervoor zou hier dus altijd falen ("constraint does not
-- exist"), en is bewust weggelaten (drizzle-kit genereert 'm standaard wél;
-- handmatig verwijderd na verificatie op de dev-DB).
DROP TABLE "meeting_slots" CASCADE;--> statement-breakpoint
DROP INDEX "meetings_slot_id_uq";--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "starts_at" timestamp with time zone NOT NULL;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "ends_at" timestamp with time zone NOT NULL;--> statement-breakpoint
ALTER TABLE "availability_windows" ADD CONSTRAINT "availability_windows_created_by_cms_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."cms_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "availability_windows_starts_at_idx" ON "availability_windows" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "meetings_starts_at_idx" ON "meetings" USING btree ("starts_at");--> statement-breakpoint
ALTER TABLE "meetings" DROP COLUMN "slot_id";--> statement-breakpoint
-- Race-proof dubbelboekingsgrendel: twee overlappende meetings kunnen niet
-- allebei bestaan. Plain GIST-exclusion op een tstzrange-expressie heeft op
-- Neon geen extra extensie nodig (btree_gist is enkel vereist voor
-- exclusion-constraints die ook een "gelijkheids"-kolom combineren, hier
-- niet het geval).
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_no_overlap" EXCLUDE USING gist (tstzrange("starts_at", "ends_at") WITH &&);
