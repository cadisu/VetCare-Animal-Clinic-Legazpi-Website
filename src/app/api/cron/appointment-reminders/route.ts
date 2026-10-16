import { bearerToken, secretsMatch } from "@/lib/sms/provider";
import { runAppointmentReminderJob } from "@/lib/sms/job";

export const dynamic = "force-dynamic";

async function run(request: Request) {
  const provided = bearerToken(request.headers.get("authorization"));
  if (!secretsMatch(process.env.CRON_SECRET, provided)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await runAppointmentReminderJob(new Date());
    return Response.json(summary);
  } catch (error) {
    console.error("Appointment reminder job failed", error instanceof Error ? error.name : "Error");
    return Response.json({ error: "Reminder job failed" }, { status: 500 });
  }
}

/** Vercel Cron invokes this path with GET. POST is accepted for the same secret. */
export function GET(request: Request) {
  return run(request);
}

export function POST(request: Request) {
  return run(request);
}
