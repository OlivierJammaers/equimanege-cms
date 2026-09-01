import type { DefaultSession } from "next-auth";

/**
 * `next-auth` en `next-auth/jwt` re-exporteren hun `Session`/`User`/`JWT`
 * types vanuit `@auth/core/types` en `@auth/core/jwt`. De interne callback-
 * signatures in `@auth/core` refereren rechtstreeks naar die onderliggende
 * modules, dus augmenteren we beide zodat `NextAuthConfig["callbacks"]` en
 * `auth()` overal hetzelfde uitgebreide type zien.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: string;
  }
}

declare module "@auth/core/types" {
  interface Session {
    user: {
      id: string;
      role: string;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: string;
  }
}
