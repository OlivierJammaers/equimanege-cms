import { expect, test, vi } from "vitest";

// auth-guards.ts importeert @/lib/auth (next-auth), wat in de vitest-omgeving
// niet resolvet — zelfde mock als auth-guards.test.ts.
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { assertAdmin } from "@/lib/auth-guards";
import { createSalesUserSchema, resetPasswordSchema } from "@/lib/user-schemas";

type SessionUser = { id: string; email: string; name: string; role: string };

// assertAdmin is de admin-gate die elke users-action als eerste aanroept.
test("assertAdmin blokkeert een sales-gebruiker", () => {
  expect(() => assertAdmin({ role: "sales" } as SessionUser)).toThrow();
});

test("assertAdmin laat een admin-gebruiker door", () => {
  expect(() => assertAdmin({ role: "admin" } as SessionUser)).not.toThrow();
});

test("assertAdmin blokkeert een ontbrekende gebruiker", () => {
  expect(() => assertAdmin(undefined)).toThrow();
});

test("createSalesUserSchema weigert een ongeldig e-mailadres", () => {
  const result = createSalesUserSchema.safeParse({
    name: "Jan Janssen",
    email: "niet-een-email",
    password: "geheimwoord123",
  });
  expect(result.success).toBe(false);
});

test("createSalesUserSchema weigert een te kort wachtwoord", () => {
  const result = createSalesUserSchema.safeParse({
    name: "Jan Janssen",
    email: "jan@example.com",
    password: "kort12",
  });
  expect(result.success).toBe(false);
});

test("createSalesUserSchema weigert een lege naam", () => {
  const result = createSalesUserSchema.safeParse({
    name: "",
    email: "jan@example.com",
    password: "geheimwoord123",
  });
  expect(result.success).toBe(false);
});

test("createSalesUserSchema aanvaardt geldige invoer", () => {
  const result = createSalesUserSchema.safeParse({
    name: "Jan Janssen",
    email: "jan@example.com",
    password: "geheimwoord123",
  });
  expect(result.success).toBe(true);
});

test("resetPasswordSchema weigert een te kort nieuw wachtwoord", () => {
  const result = resetPasswordSchema.safeParse({
    id: "11111111-1111-4111-8111-111111111111",
    newPassword: "kort",
  });
  expect(result.success).toBe(false);
});

test("resetPasswordSchema aanvaardt geldige invoer", () => {
  const result = resetPasswordSchema.safeParse({
    id: "11111111-1111-4111-8111-111111111111",
    newPassword: "nieuwwachtwoord123",
  });
  expect(result.success).toBe(true);
});

test("loginCredentialsSchema normaliseert e-mail naar lowercase en trimt witruimte", async () => {
  const { loginCredentialsSchema } = await import("@/lib/user-schemas");
  const parsed = loginCredentialsSchema.parse({
    email: "  Olivier@EquiManage.EU ",
    password: "geheim123",
  });
  expect(parsed.email).toBe("olivier@equimanage.eu");
});

test("loginCredentialsSchema weigert een ongeldig e-mailadres", async () => {
  const { loginCredentialsSchema } = await import("@/lib/user-schemas");
  expect(() =>
    loginCredentialsSchema.parse({ email: "geen-email", password: "x" }),
  ).toThrow();
});
