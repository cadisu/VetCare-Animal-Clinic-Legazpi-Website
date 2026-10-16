import { createAdminClient } from "@/lib/supabase/admin";
import { parseWebhookBody, secretsMatch } from "@/lib/sms/provider";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const provided = request.headers.get("webhook-secret-key");
  if (!secretsMatch(process.env.UNISMS_WEBHOOK_SECRET_KEY, provided)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const parsed = parseWebhookBody(body);
  if (!parsed.ok) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return Response.json({ error: "SMS tracking is not configured" }, { status: 503 });
  }

  const webhookId = request.headers.get("webhook-id");
  const { data, error } = await admin.rpc("apply_sms_provider_event", {
    p_reference_id: parsed.referenceId,
    p_event: parsed.event,
    p_provider_status: parsed.providerStatus,
    p_fail_reason: parsed.failReason,
    p_webhook_id: webhookId,
    p_payload: body,
  });

  if (error) {
    console.error("UniSMS webhook was not applied");
    return Response.json({ error: "Not applied" }, { status: 500 });
  }

  return Response.json(data ?? { matched: false });
}
