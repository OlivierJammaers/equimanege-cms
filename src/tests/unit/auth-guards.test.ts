import { expect, test, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { assertAdmin, assertUser } from "@/lib/auth-guards";

type SessionUser = { id: string; email: string; name: string; role: string };

test("assertAdmin throws for sales role", () => {
  expect(() => assertAdmin({ role: "sales" } as SessionUser)).toThrow();
});

test("assertAdmin does not throw for admin role", () => {
  expect(() => assertAdmin({ role: "admin" } as SessionUser)).not.toThrow();
});

test("assertAdmin throws when user is undefined", () => {
  expect(() => assertAdmin(undefined)).toThrow();
});

test("assertUser throws when user is null", () => {
  expect(() => assertUser(null)).toThrow();
});

test("assertUser throws when user is undefined", () => {
  expect(() => assertUser(undefined)).toThrow();
});

test("assertUser does not throw for a defined user", () => {
  const user: SessionUser = { id: "1", email: "a@b.com", name: "A", role: "sales" };
  expect(() => assertUser(user)).not.toThrow();
});
