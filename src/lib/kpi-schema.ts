import { z } from "zod";

/**
 * Spiegelt exact het payload-contract van de backend
 * (`GET /internal/cms-kpis`, zie docs/superpowers/plans/2026-09-01-fase2-kpi-integratie.md
 * onder "Global Constraints"). Getallen kunnen als int of float binnenkomen.
 */
export const kpiTenantBlockSchema = z.object({
  tenant: z.object({
    id: z.number(),
    name: z.string(),
    email: z.string(),
    company_name: z.string(),
    role: z.string(),
    created_at: z.string(),
  }),
  lessons: z.object({
    total: z.number(),
    upcoming: z.number(),
    this_week: z.number(),
    completed_30d: z.number(),
    completed_90d: z.number(),
    cancelled_30d: z.number(),
    cancellation_rate_90d: z.number(),
    avg_participants_30d: z.number(),
    occupancy_rate_30d: z.number(),
    pending_registrations: z.number(),
  }),
  members: z.object({
    total: z.number(),
    active: z.number(),
    pending: z.number(),
    expiring_30d: z.number(),
    new_30d: z.number(),
    instructors: z.number(),
  }),
  engagement: z.object({
    last_active_at: z.string().nullable(),
    active_push_devices_30d: z.number(),
    announcements_30d: z.number(),
    chat_messages_30d: z.number(),
  }),
  commercial: z.object({
    monthly_price: z.number(),
    invoiced_30d: z.number(),
    invoiced_ytd: z.number(),
    invoices_paid_30d: z.number(),
    invoices_open: z.number(),
    invoices_overdue: z.number(),
    member_limit: z.number().nullable(),
    horse_limit: z.number().nullable(),
  }),
  adoption: z.object({
    horses: z.number(),
    pistes: z.number(),
    groups: z.number(),
    invoicing_in_use: z.boolean(),
  }),
});

export const kpiResponseSchema = z.object({
  generated_at: z.string(),
  tenants: z.array(kpiTenantBlockSchema),
});

export type KpiTenantBlock = z.infer<typeof kpiTenantBlockSchema>;
export type KpiResponse = z.infer<typeof kpiResponseSchema>;
