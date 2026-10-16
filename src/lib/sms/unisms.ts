import type { GetSmsOutcome, SmsSendOutcome } from "@/lib/sms/provider";
import { classifyGetResponse, classifySendResponse } from "@/lib/sms/provider";

const SEND_URL = "https://unismsapi.com/api/sms";

export type UnisMsFetcher = (url: string, init: RequestInit) => Promise<Response>;

function basicAuthHeader(secretKey: string): string {
  return `Basic ${Buffer.from(`${secretKey}:`, "utf8").toString("base64")}`;
}

async function readBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

/**
 * Single-message UniSMS client. Metadata is internal tracking only.
 * The provider docs do not provide an idempotency key.
 */
export function createUnisMsClient(options: {
  secretKey: string;
  senderId: string;
  fetchImpl?: UnisMsFetcher;
  timeoutMs?: number;
}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 15_000;

  async function request(url: string, init: RequestInit): Promise<Response> {
    return fetchImpl(url, {
      ...init,
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Accept: "application/json",
        Authorization: basicAuthHeader(options.secretKey),
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
    });
  }

  return {
    async sendSms(input: {
      recipient: string;
      content: string;
      metadata?: Record<string, string>;
    }): Promise<SmsSendOutcome> {
      try {
        const response = await request(SEND_URL, {
          method: "POST",
          body: JSON.stringify({
            recipient: input.recipient,
            content: input.content,
            sender_id: options.senderId,
            ...(input.metadata ? { metadata: input.metadata } : {}),
          }),
        });
        const text = await readBody(response);
        return classifySendResponse(response.status, text, response.headers.get("x-retry-after-ms"));
      } catch {
        return { kind: "uncertain", error: "The UniSMS request did not finish. It was not sent again." };
      }
    },

    async getSms(referenceId: string): Promise<GetSmsOutcome> {
      try {
        const response = await request(`${SEND_URL}/${encodeURIComponent(referenceId)}`, { method: "GET" });
        const text = await readBody(response);
        return classifyGetResponse(response.status, text);
      } catch {
        return { kind: "transient", error: "The UniSMS status request did not finish." };
      }
    },
  };
}

export function unisMsConfigured(): { secretKey: string; senderId: string } | null {
  const secretKey = process.env.UNISMS_API_SECRET_KEY?.trim() ?? "";
  const senderId = process.env.UNISMS_SENDER_ID?.trim() ?? "";
  if (!secretKey || !senderId) return null;
  return { secretKey, senderId };
}
