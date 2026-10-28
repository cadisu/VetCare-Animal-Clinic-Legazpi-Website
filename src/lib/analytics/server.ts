import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { APPOINTMENT_STATUSES, type AppointmentStatus } from "@/lib/appointments/constants";
import { appointmentStatusTotal, zeroFillSalesDays, type SalesDay } from "@/lib/analytics/metrics";

export type ServiceAnalytic = {
  serviceId: string | null;
  description: string;
  transactionCount: number;
  recordedAmount: number;
};

export type RecentSale = {
  id: string | null;
  reference: string;
  completedAt: string;
  gross: number;
  discounts: number;
  rewards: number;
  recordedSales: number;
};

export type AnalyticsReport = {
  customersRegistered: number;
  appointments: {
    scheduled: number;
    booked: number;
    statuses: Record<AppointmentStatus, number>;
    sources: { appointment: number; walkIn: number };
  };
  services: { bills: number; rows: ServiceAnalytic[] };
  sales: {
    transactions: number;
    gross: number;
    discounts: number;
    rewards: number;
    recordedSales: number;
    counterBills: number;
    counterRecordedSales: number;
    days: SalesDay[];
    recent: RecentSale[];
  };
  loyalty: {
    stampsEarnedNet: number;
    stampsReversed: number;
    rewardsUnlocked: number;
    rewardsRevoked: number;
    rewardsRedeemed: number;
    redemptionsRestored: number;
  };
};

type RpcPayload = {
  customers_registered?: unknown;
  appointments?: {
    scheduled?: unknown;
    booked?: unknown;
    statuses?: Record<string, unknown>;
    sources?: Record<string, unknown>;
  };
  services?: { bills?: unknown; rows?: unknown };
  sales?: Record<string, unknown>;
  loyalty?: Record<string, unknown>;
};

function num(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function parseReport(data: RpcPayload, from: string, to: string): AnalyticsReport | null {
  const statuses = Object.fromEntries(
    APPOINTMENT_STATUSES.map((status) => [status, num(data.appointments?.statuses?.[status])]),
  ) as Record<AppointmentStatus, number>;
  const scheduled = num(data.appointments?.scheduled);
  if (appointmentStatusTotal(statuses) !== scheduled) return null;

  const dayRows = Array.isArray(data.sales?.days) ? data.sales.days : [];
  const days = zeroFillSalesDays(
    from,
    to,
    dayRows.map((row) => {
      const day = row as Record<string, unknown>;
      return {
        date: text(day.date, ""),
        gross: num(day.gross),
        discounts: num(day.discounts),
        rewards: num(day.rewards),
        recordedSales: num(day.recorded_sales),
        transactions: num(day.transactions),
      };
    }).filter((day) => day.date),
  );

  const serviceRows = Array.isArray(data.services?.rows) ? data.services.rows : [];
  const recentRows = Array.isArray(data.sales?.recent) ? data.sales.recent : [];

  return {
    customersRegistered: num(data.customers_registered),
    appointments: {
      scheduled,
      booked: num(data.appointments?.booked),
      statuses,
      sources: {
        appointment: num(data.appointments?.sources?.APPOINTMENT),
        walkIn: num(data.appointments?.sources?.WALK_IN),
      },
    },
    services: {
      bills: num(data.services?.bills),
      rows: serviceRows.map((row) => {
        const service = row as Record<string, unknown>;
        return {
          serviceId: typeof service.service_id === "string" ? service.service_id : null,
          description: text(service.description, "Service"),
          transactionCount: num(service.transaction_count),
          recordedAmount: num(service.recorded_amount),
        };
      }),
    },
    sales: {
      transactions: num(data.sales?.transactions),
      gross: num(data.sales?.gross),
      discounts: num(data.sales?.discounts),
      rewards: num(data.sales?.rewards),
      recordedSales: num(data.sales?.recorded_sales),
      counterBills: num(data.sales?.counter_bills),
      counterRecordedSales: num(data.sales?.counter_recorded_sales),
      days,
      recent: recentRows.map((row) => {
        const sale = row as Record<string, unknown>;
        return {
          id: typeof sale.id === "string" ? sale.id : null,
          reference: text(sale.reference, "Bill"),
          completedAt: text(sale.completed_at, ""),
          gross: num(sale.gross),
          discounts: num(sale.discounts),
          rewards: num(sale.rewards),
          recordedSales: num(sale.recorded_sales),
        };
      }),
    },
    loyalty: {
      stampsEarnedNet: num(data.loyalty?.stamps_earned_net),
      stampsReversed: num(data.loyalty?.stamps_reversed),
      rewardsUnlocked: num(data.loyalty?.rewards_unlocked),
      rewardsRevoked: num(data.loyalty?.rewards_revoked),
      rewardsRedeemed: num(data.loyalty?.rewards_redeemed),
      redemptionsRestored: num(data.loyalty?.redemptions_restored),
    },
  };
}

export async function loadClinicAnalytics(
  supabase: SupabaseClient,
  from: string,
  to: string,
): Promise<{ ok: true; report: AnalyticsReport } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc("clinic_analytics_report", { p_from: from, p_to: to });
  if (error || !data || typeof data !== "object") {
    return { ok: false, message: "Analytics could not be loaded." };
  }
  const report = parseReport(data as RpcPayload, from, to);
  if (!report) {
    return { ok: false, message: "Appointment counts could not be reconciled." };
  }
  const sourceTotal = report.appointments.sources.appointment + report.appointments.sources.walkIn;
  if (sourceTotal !== report.appointments.scheduled) {
    return { ok: false, message: "Appointment counts could not be reconciled." };
  }
  return { ok: true, report };
}
