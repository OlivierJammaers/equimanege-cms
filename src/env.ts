import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  DATABASE_URL_UNPOOLED: z.string().url().optional(),
  AUTH_SECRET: z.string().min(16),
  // KPI-integratie (fase 2) — optioneel zodat een build zonder deze env-vars
  // blijft werken; de runtime-code (src/server/kpi-sync.ts) gooit een
  // duidelijke NL-foutmelding wanneer ze nodig-maar-afwezig zijn.
  KPI_SYNC_SECRET: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  EQUIMANEGE_API_URL: z.string().url().default("https://api.equimanage.eu/api"),
});

export const env = schema.parse(process.env);
