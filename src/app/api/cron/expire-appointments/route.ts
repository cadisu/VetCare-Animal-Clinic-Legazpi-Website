import { bearerToken, secretsMatch } from "@/lib/sms/provider";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function run(request: Request) {
  const provided = bearerToken(request.headers.get("authorization"));
  if (!secretsMatch(process.env.CRON_SECRET, provided)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return Response.json({ error: "Appointment expiry is not configured" }, { status: 500 });
  }

  try {
    const { data, error } = await admin.rpc("expire_unconfirmed_appointments");
    if (error) throw error;
    return Response.json({ expired: typeof data === "number" ? data : 0 });
  } catch (error) {
    console.error("Appointment expiry job failed", error instanceof Error ? error.name : "Error");
    return Response.json({ error: "Appointment expiry job failed" }, { status: 500 });
  }
}

/** Vercel Cron invokes this path with GET. POST is accepted for the same secret. */
export function GET(request: Request) {
  return run(request);
}

export function POST(request: Request) {
  return run(request);
}
