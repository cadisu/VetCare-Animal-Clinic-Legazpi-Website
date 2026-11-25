import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Move past unconfirmed visits to Expired. A missed cron still corrects the lists on the next page load. */
export const expireUnconfirmedAppointments = cache(async (supabase: SupabaseClient): Promise<void> => {
  const { error } = await supabase.rpc("expire_unconfirmed_appointments");
  if (error) console.error("Could not expire unconfirmed appointments");
});
