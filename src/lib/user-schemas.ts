import { z } from "zod";

/**
 * Pure Zod-schema's voor de gebruikersbeheer-acties (`src/server/actions/users.ts`).
 * Los van server-code gehouden zodat validatie zonder DB/auth-runtime
 * unit-testbaar is.
 */

export const createSalesUserSchema = z.object({
  name: z.string().trim().min(1, "Naam is verplicht."),
  email: z.string().trim().toLowerCase().email("Ongeldig e-mailadres."),
  password: z.string().min(8, "Wachtwoord moet minstens 8 tekens lang zijn."),
});

export type CreateSalesUserInput = z.infer<typeof createSalesUserSchema>;

export const resetPasswordSchema = z.object({
  id: z.string().uuid(),
  newPassword: z.string().min(8, "Wachtwoord moet minstens 8 tekens lang zijn."),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const userIdSchema = z.object({
  id: z.string().uuid(),
});
