import { timingSafeEqual } from "node:crypto";

export const PROVIDER_STATUSES = ["pending", "retrying", "sent", "failed"] as const;
export type ProviderStatus = (typeof PROVIDER_STATUSES)[number];

export const WEBHOOK_EVENTS = ["message.sent", "message.failed", "message.retrying"] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export function isProviderStatus(value: unknown): value is ProviderStatus {
  return typeof value === "string" && (PROVIDER_STATUSES as readonly string[]).includes(value);
}

/**
 * Compare two secrets without throwing. timingSafeEqual requires equal buffer lengths.
 * An empty expected secret never matches, so an unconfigured webhook stays closed.
 */
export function secretsMatch(expected: string | undefined, provided: string | null | undefined): boolean {
  if (!expected || !provided) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(provided);
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function bearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

export type ParsedProviderMessage = {
  status: ProviderStatus;
  referenceId: string;
  failReason: string | null;
};

export function parseProviderMessage(body: unknown): ParsedProviderMessage | null {
  if (!body || typeof body !== "object") return null;
  const message = (body as { message?: unknown }).message;
  if (!message || typeof message !== "object") return null;
  const row = message as { status?: unknown; reference_id?: unknown; fail_reason?: unknown };
  if (!isProviderStatus(row.status)) return null;
  if (typeof row.reference_id !== "string" || row.reference_id.length === 0) return null;
  const failReason = typeof row.fail_reason === "string" && row.fail_reason.length > 0 ? row.fail_reason : null;
  return { status: row.status, referenceId: row.reference_id, failReason };
}

export type WebhookParse =
  | {
      ok: true;
      id: string;
      event: WebhookEvent;
      referenceId: string;
      providerStatus: ProviderStatus;
      failReason: string | null;
    }
  | { ok: false };

export function parseWebhookBody(body: unknown): WebhookParse {
  if (!body || typeof body !== "object") return { ok: false };
  const row = body as { id?: unknown; event?: unknown; message?: unknown };
  if (typeof row.event !== "string" || !(WEBHOOK_EVENTS as readonly string[]).includes(row.event)) {
    return { ok: false };
  }
  if (typeof row.id !== "string" || row.id.length === 0) return { ok: false };
  const message = parseProviderMessage({ message: row.message });
  if (!message) return { ok: false };
  const event = row.event as WebhookEvent;
  if (event === "message.sent" && message.status !== "sent") return { ok: false };
  if (event === "message.failed" && message.status !== "failed") return { ok: false };
  if (event === "message.retrying" && message.status !== "retrying") return { ok: false };
  return {
    ok: true,
    id: row.id,
    event,
    referenceId: message.referenceId || row.id,
    providerStatus: message.status,
    failReason: message.failReason,
  };
}

export type SmsSnapshot = {
  status: "PENDING" | "QUEUED" | "SENT" | "FAILED" | "CANCELLED";
  providerStatus: ProviderStatus | null;
};

/** Pure mirror of the webhook status rules enforced in the database. */
export function webhookEffect(
  current: SmsSnapshot,
  event: WebhookEvent,
): "apply" | "ignore" | "duplicate" {
  if (current.status === "CANCELLED") return "ignore";
  if (event === "message.sent") {
    if (current.status === "SENT" && current.providerStatus === "sent") return "duplicate";
    return "apply";
  }
  if (event === "message.failed") {
    if (current.status === "SENT" || current.providerStatus === "sent") return "ignore";
    if (current.status === "FAILED" && current.providerStatus === "failed") return "duplicate";
    return "apply";
  }
  if (current.status === "SENT" || current.status === "FAILED" || current.providerStatus === "sent" || current.providerStatus === "failed") {
    return "ignore";
  }
  return "apply";
}

export function smsStatusLabel(status: string, providerStatus: string | null): string {
  if (status === "SENT") return "Reported sent";
  if (status === "QUEUED" && providerStatus === "retrying") return "Provider retrying";
  if (status === "QUEUED" && providerStatus === "pending") return "Accepted, pending";
  if (status === "QUEUED") return "Queued";
  if (status === "FAILED") return "Failed";
  if (status === "CANCELLED") return "Cancelled";
  if (status === "PENDING") return "Waiting to send";
  return "Unknown";
}

export function smsStatusNote(status: string, providerStatus: string | null): string | null {
  if (status === "SENT") {
    return "UniSMS reported this message as sent. That does not confirm the phone received it.";
  }
  if (status === "QUEUED" && (providerStatus === "pending" || providerStatus === "retrying" || providerStatus === null)) {
    return "UniSMS accepted this message. Pending or retrying is not the same as sent, and sent is not delivery to the phone.";
  }
  return null;
}

export function canManuallyRetry(row: {
  status: string;
  failureClass: string;
  outcomeUncertain: boolean;
  providerStatus: string | null;
}): boolean {
  if (row.outcomeUncertain) return false;
  if (row.status !== "FAILED") return false;
  if (row.failureClass !== "config" && row.failureClass !== "transient") return false;
  if (row.providerStatus === "pending" || row.providerStatus === "retrying" || row.providerStatus === "sent") {
    return false;
  }
  return true;
}

export type SmsSendOutcome =
  | {
      kind: "accepted";
      providerStatus: ProviderStatus;
      referenceId: string;
      failReason: string | null;
      response: unknown;
    }
  | { kind: "config"; error: string; response?: unknown }
  | { kind: "validation"; error: string; response?: unknown }
  | { kind: "transient"; error: string; retryAfterMs: number | null; response?: unknown }
  | { kind: "uncertain"; error: string };

export type GetSmsOutcome =
  | { kind: "status"; message: ParsedProviderMessage; response: unknown }
  | { kind: "not_found" }
  | { kind: "config"; error: string }
  | { kind: "transient"; error: string };

function retryAfterMs(header: string | null): number | null {
  if (!header) return null;
  const value = Number(header);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

function safeJson(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text.slice(0, 500) };
  }
}

/** Maps a documented POST /sms response. Does not treat metadata as an idempotency key. */
export function classifySendResponse(status: number, bodyText: string, retryHeader: string | null): SmsSendOutcome {
  const response = safeJson(bodyText);
  if (status === 201) {
    const message = parseProviderMessage(response);
    if (!message) return { kind: "uncertain", error: "UniSMS accepted a response that could not be reconciled." };
    return {
      kind: "accepted",
      providerStatus: message.status,
      referenceId: message.referenceId,
      failReason: message.failReason,
      response,
    };
  }
  if (status === 401) return { kind: "config", error: "UniSMS rejected the API credentials.", response };
  if (status === 422) return { kind: "validation", error: "UniSMS rejected the message.", response };
  if (status === 429) {
    return {
      kind: "transient",
      error: "UniSMS rate limited the send.",
      retryAfterMs: retryAfterMs(retryHeader),
      response,
    };
  }
  if (status >= 500) return { kind: "transient", error: "UniSMS returned a server error.", retryAfterMs: null, response };
  return { kind: "transient", error: "UniSMS returned an unexpected response.", retryAfterMs: null, response };
}

export function classifyGetResponse(status: number, bodyText: string): GetSmsOutcome {
  const response = safeJson(bodyText);
  if (status === 200) {
    const message = parseProviderMessage(response);
    if (!message) return { kind: "transient", error: "UniSMS status response could not be read." };
    return { kind: "status", message, response };
  }
  if (status === 401) return { kind: "config", error: "UniSMS rejected the API credentials." };
  if (status === 404) return { kind: "not_found" };
  return { kind: "transient", error: "UniSMS status could not be retrieved." };
}

export function eventForProviderStatus(status: ProviderStatus): WebhookEvent | null {
  if (status === "sent") return "message.sent";
  if (status === "failed") return "message.failed";
  if (status === "retrying") return "message.retrying";
  return null;
}
