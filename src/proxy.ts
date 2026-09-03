import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

/**
 * Next.js 16 hernoemde `middleware.ts` naar `proxy.ts` (edge-runtime is hier
 * niet meer beschikbaar, proxy draait altijd op de Node.js-runtime — zie
 * node_modules/next/dist/docs/.../upgrading/version-16.md, sectie
 * "middleware to proxy"). Dit bestand importeert alleen de edge/proxy-veilige
 * `authConfig` (geen providers, geen DB/bcrypt) zodat de proxy-bundle licht
 * blijft, ook al staat DB-toegang hier technisch niet meer in de weg zoals
 * bij de vroegere edge-middleware.
 */
export const { auth } = NextAuth(authConfig);

export const proxy = auth;

export const config = {
  // api/cron en api/crawl uitgezonderd: die routes beveiligen zichzelf met
  // CRON_SECRET/admin-check (src/app/api/cron/kpi-sync/route.ts,
  // src/app/api/crawl/process/route.ts) — Vercel-cron heeft geen
  // login-sessie en zou anders naar /login redirecten. Admin-sessie-
  // aanroepen (de crawl-run-driver) hebben wél een sessiecookie, dus die
  // passeren de proxy sowieso zonder redirect; de uitzondering is puur voor
  // de cron-aanroepen zonder sessie.
  matcher: ["/((?!login|api/auth|api/cron|api/crawl|_next|favicon).*)"],
};
