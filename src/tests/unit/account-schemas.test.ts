import { describe, expect, test } from "vitest";
import { accountFormSchema } from "@/lib/account-schemas";

describe("accountFormSchema", () => {
  test("weigert een lege naam", () => {
    const result = accountFormSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  test("weigert een ontbrekende naam", () => {
    const result = accountFormSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  test("trimt de naam", () => {
    const result = accountFormSchema.parse({ name: "  Manege Test  " });
    expect(result.name).toBe("Manege Test");
  });

  test("lege optionele tekstvelden worden null", () => {
    const result = accountFormSchema.parse({
      name: "Test Manege",
      gemeente: "",
      postcode: "",
      address: "",
      phone: "",
      website: "",
      category: "",
      contactPerson: "",
    });
    expect(result.gemeente).toBeNull();
    expect(result.postcode).toBeNull();
    expect(result.address).toBeNull();
    expect(result.phone).toBeNull();
    expect(result.website).toBeNull();
    expect(result.category).toBeNull();
    expect(result.contactPerson).toBeNull();
  });

  test("ontbrekende optionele tekstvelden worden null", () => {
    const result = accountFormSchema.parse({ name: "Test Manege" });
    expect(result.gemeente).toBeNull();
    expect(result.postcode).toBeNull();
  });

  test("ingevulde optionele velden worden getrimd bewaard", () => {
    const result = accountFormSchema.parse({
      name: "Test",
      gemeente: "  Hasselt  ",
    });
    expect(result.gemeente).toBe("Hasselt");
  });

  test("weigert een ongeldig e-mailadres", () => {
    const result = accountFormSchema.safeParse({
      name: "Test",
      email: "niet-een-email",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Ongeldig e-mailadres.");
    }
  });

  test("een lege e-mail is toegestaan en wordt null", () => {
    const result = accountFormSchema.parse({ name: "Test", email: "" });
    expect(result.email).toBeNull();
  });

  test("een ontbrekende e-mail wordt null", () => {
    const result = accountFormSchema.parse({ name: "Test" });
    expect(result.email).toBeNull();
  });

  test("een geldig e-mailadres blijft behouden", () => {
    const result = accountFormSchema.parse({
      name: "Test",
      email: "info@example.com",
    });
    expect(result.email).toBe("info@example.com");
  });

  test("een lege prioriteit ('') wordt null", () => {
    const result = accountFormSchema.parse({ name: "Test", priority: "" });
    expect(result.priority).toBeNull();
  });

  test("een ontbrekende prioriteit wordt null", () => {
    const result = accountFormSchema.parse({ name: "Test" });
    expect(result.priority).toBeNull();
  });

  test("een geldige prioriteit blijft behouden", () => {
    const result = accountFormSchema.parse({ name: "Test", priority: "A" });
    expect(result.priority).toBe("A");
  });

  test("weigert een ongeldige prioriteit", () => {
    const result = accountFormSchema.safeParse({ name: "Test", priority: "Z" });
    expect(result.success).toBe(false);
  });

  test("type is standaard 'prospect'", () => {
    const result = accountFormSchema.parse({ name: "Test" });
    expect(result.type).toBe("prospect");
  });

  test("type 'customer' blijft behouden", () => {
    const result = accountFormSchema.parse({ name: "Test", type: "customer" });
    expect(result.type).toBe("customer");
  });
});
