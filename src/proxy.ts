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
  matcher: ["/((?!login|api/auth|_next|favicon).*)"],
};
