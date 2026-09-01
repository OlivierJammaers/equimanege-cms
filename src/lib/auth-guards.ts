import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";

export type SessionUser = Session["user"];

/**
 * Pure guards — gooien een fout, redirecten niet. Unit-testbaar zonder
 * Next.js-runtime of gemockte `redirect`.
 */
export function assertUser(
  user: SessionUser | null | undefined,
): asserts user is SessionUser {
  if (!user) {
    throw new Error("Niet ingelogd.");
  }
}

export function assertAdmin(
  user: SessionUser | null | undefined,
): asserts user is SessionUser {
  assertUser(user);
  if (user.role !== "admin") {
    throw new Error("Geen adminrechten.");
  }
}

/**
 * Redirect-varianten — voor gebruik in server components/actions.
 */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session.user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  try {
    assertAdmin(user);
  } catch {
    redirect("/");
  }
  return user;
}
