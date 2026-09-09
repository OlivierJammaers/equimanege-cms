"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PERIOD_LABELS, type KpiPeriod } from "@/lib/kpi-period";

const PERIODS: KpiPeriod[] = ["24h", "7d", "30d"];

/**
 * 3-weg periodetoggle (24 uur / 7 dagen / 30 dagen) voor de KPI-weergaves op
 * het accountdetail en de klant-grafiekenpagina. Puur besturend — de
 * ouder-component beslist wat er met `value`/`onValueChange` gebeurt.
 */
export function PeriodToggle({
  value,
  onValueChange,
}: {
  value: KpiPeriod;
  onValueChange: (period: KpiPeriod) => void;
}) {
  return (
    <Tabs
      value={value}
      onValueChange={(next) => onValueChange(next as KpiPeriod)}
    >
      <TabsList>
        {PERIODS.map((period) => (
          <TabsTrigger key={period} value={period}>
            {PERIOD_LABELS[period]}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
