ALTER TABLE "accounts" ADD COLUMN "released_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "accounts_released_at_idx" ON "accounts" USING btree ("released_at");