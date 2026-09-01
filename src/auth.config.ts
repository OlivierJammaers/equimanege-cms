import type { NextAuthConfig } from "next-auth";

/**
 * Edge/proxy-safe Auth.js config: geen providers die de DB-client of
 * bcryptjs importeren. De echte Credentials-provider (met DB-lookup en
 * bcrypt.compare) leeft in `src/lib/auth.ts`, dat deze config uitbreidt.
 * `src/proxy.ts` importeert uitsluitend dit bestand.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
