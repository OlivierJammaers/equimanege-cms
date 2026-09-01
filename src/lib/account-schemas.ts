import { z } from "zod";
import { PRIORITIES } from "@/lib/constants";

/**
 * Pure Zod-schema voor het account-formulier (aanmaken + bewerken van de
 * kernvelden). Los van server-code gehouden zodat validatie zonder
 * DB/auth-runtime unit-testbaar is — zelfde patroon als user-schemas.ts.
 */

function optionalTrimmedToNull() {
  return z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null));
}

// Radix Select stuurt "" voor "geen keuze"; undefined komt voor als het veld
// helemaal niet meegegeven wordt. Beide worden null vóór de enum-validatie.
const priorityField = z.preprocess(
  (value) => (value === "" || value === undefined ? null : value),
  z.enum(PRIORITIES).nullable(),
);

const emailField = z
  .string()
  .trim()
  .optional()
  .refine((value) => !value || z.string().email().safeParse(value).success, {
    message: "Ongeldig e-mailadres.",
  })
  .transform((value) => (value && value.length > 0 ? value : null));

export const accountFormSchema = z.object({
  name: z.string().trim().min(1, "Naam is verplicht."),
  type: z.enum(["prospect", "customer"]).default("prospect"),
  priority: priorityField,
  gemeente: optionalTrimmedToNull(),
  postcode: optionalTrimmedToNull(),
  address: optionalTrimmedToNull(),
  phone: optionalTrimmedToNull(),
  website: optionalTrimmedToNull(),
  category: optionalTrimmedToNull(),
  contactPerson: optionalTrimmedToNull(),
  email: emailField,
});

// Output-type (na trim/transform naar null) — wat de server-actions ontvangen
// ná `accountFormSchema.parse(...)`.
export type AccountFormValues = z.infer<typeof accountFormSchema>;

// Input-type (vóór transform) — wat het formulier (ruwe strings, incl. "" voor
// "geen keuze") daadwerkelijk naar de server-actions stuurt.
export type AccountFormInput = z.input<typeof accountFormSchema>;
