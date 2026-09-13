/**
 * Polar webhook -> Meta (Facebook) Conversions API "Purchase"
 * ----------------------------------------------------------
 * Route: POST https://<your-pages-domain>/api/polar-webhook
 *
 * Required Cloudflare Pages environment variables (Settings -> Variables and Secrets):
 *   META_ACCESS_TOKEN     (Secret)  Meta Conversions API access token
 *   META_PIXEL_ID         (Text)    e.g. 1691200178640604
 *   POLAR_WEBHOOK_SECRET  (Secret)  the secret you set when creating the Polar webhook endpoint
 *   META_TEST_EVENT_CODE  (Secret, optional) while testing; REMOVE it when done or
 *                                   events will not count towards the pixel.
 *
 * Polar signs payloads two ways depending on secret age:
 *   - Secrets created on/after 8 Sep 2026: Standard Webhooks scheme
 *     (headers: webhook-id, webhook-timestamp, webhook-signature; base64 HMAC-SHA256
 *     over "<id>.<timestamp>.<raw body>", entries prefixed "v1,")
 *   - Older secrets: legacy Polar HMAC (header: polar-signature; hex HMAC-SHA256 of the raw body)
 * Both are verified here.
 */

const FB_API_VERSION = "v21.0";
const EVENT_SOURCE_URL = "https://before-you-resign.aijazmohammad.com/";
const DEFAULT_VALUE = 9.99; // used only if Polar's payload somehow lacks an amount
const DEFAULT_PRODUCT_ID = "before-you-resign-ebook";
const SIGNATURE_MAX_AGE_SECONDS = 600;

function bytesToB64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function b64ToBytes(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function hmacSha256(keyBytes, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return new Uint8Array(sig);
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return bytesToHex(new Uint8Array(digest));
}

/** Standard Webhooks verification (Polar secrets generated on/after 8 Sep 2026). */
async function verifyStandardWebhooks(request, rawBody, secret) {
  const id = request.headers.get("webhook-id");
  const ts = request.headers.get("webhook-timestamp");
  const sigHeader = request.headers.get("webhook-signature");
  if (!id || !ts || !sigHeader) return false;

  const age = Math.abs(Math.floor(Date.now() / 1000) - parseInt(ts, 10));
  if (!Number.isFinite(age) || age > SIGNATURE_MAX_AGE_SECONDS) return false;

  // Secret may carry the "whsec_" prefix; the key is the base64 part.
  const keyStr = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  let keyBytes;
  try {
    keyBytes = b64ToBytes(keyStr);
  } catch {
    keyBytes = new TextEncoder().encode(keyStr);
  }

  const expected = bytesToB64(await hmacSha256(keyBytes, id + "." + ts + "." + rawBody));
  return sigHeader.split(",").some((entry) => {
    const trimmed = entry.trim();
    const eq = trimmed.indexOf("=");
    if (eq < 0) return false;
    const version = trimmed.slice(0, eq);
    const sig = trimmed.slice(eq + 1);
    return version === "v1" && timingSafeEqual(new TextEncoder().encode(sig), new TextEncoder().encode(expected));
  });
}

/** Legacy Polar HMAC verification (older secrets). */
async function verifyLegacyPolar(request, rawBody, secret) {
  const sigHeader = request.headers.get("polar-signature");
  if (!sigHeader) return false;
  const keyBytes = secret.startsWith("whsec_")
    ? (() => { try { return b64ToBytes(secret.slice("whsec_".length)); } catch { return new TextEncoder().encode(secret); } })()
    : new TextEncoder().encode(secret);
  const expected = bytesToHex(await hmacSha256(keyBytes, rawBody));
  return sigHeader.split(",").some((entry) => {
    const candidate = entry.trim().replace(/^v1=/, "");
    return timingSafeEqual(
      new TextEncoder().encode(candidate.toLowerCase()),
      new TextEncoder().encode(expected.toLowerCase())
    );
  });
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "content-type": "application/json" },
  });
}

// Simple smoke test: open the URL in a browser to confirm the Function is deployed.
export async function onRequestGet() {
  return json({
    ok: true,
    endpoint: "polar-webhook",
    expects: "POST with Polar webhook payload (order.paid)",
    token_configured: false, // never echo secrets; check your Cloudflare vars list
  });
}

export async function onRequestPost({ request, env }) {
  const rawBody = await request.text();
  const secret = env.POLAR_WEBHOOK_SECRET;

  if (secret) {
    const standardOk = await verifyStandardWebhooks(request, rawBody, secret);
    let legacyOk = false;
    if (!standardOk && request.headers.get("polar-signature")) {
      legacyOk = await verifyLegacyPolar(request, rawBody, secret);
    }
    if (!standardOk && !legacyOk) {
      console.warn("polar-webhook: signature verification failed");
      return json({ error: "invalid signature" }, 401);
    }
  } else {
    console.warn(
      "polar-webhook: POLAR_WEBHOOK_SECRET is not set - accepting UNVERIFIED request. " +
        "Set it (and redeploy) as soon as you create the webhook in Polar."
    );
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const type = payload && payload.type;
  if (type !== "order.paid") {
    return json({ ignored: type || "unknown event" });
  }

  const token = env.META_ACCESS_TOKEN;
  const pixelId = env.META_PIXEL_ID;
  if (!token || !pixelId) {
    console.error("polar-webhook: META_ACCESS_TOKEN / META_PIXEL_ID not configured");
    // 200 so Polar does not retry forever while setup is incomplete.
    return json({ skipped: "META_ACCESS_TOKEN or META_PIXEL_ID missing in Cloudflare env" });
  }

  const data = (payload && payload.data) || {};
  const email = data.customer && data.customer.email;

  // Polar amounts are integer minor units (cents).
  const amountMajor =
    typeof data.net_amount === "number"
      ? data.net_amount / 100
      : typeof data.amount === "number"
        ? data.amount / 100
        : DEFAULT_VALUE;
  const currency = String(data.currency || "usd").toUpperCase();
  const paidAt = data.paid_at ? Date.parse(data.paid_at) : NaN;
  const eventTime = Number.isFinite(paidAt) ? Math.floor(paidAt / 1000) : Math.floor(Date.now() / 1000);
  const eventId = "polar_" + (data.id || eventTime);

  const userData = {};
  if (email) {
    userData.em = [await sha256Hex(String(email).trim().toLowerCase())];
  }

  const fbPayload = {
    data: [
      {
        event_name: "Purchase",
        event_time: eventTime,
        event_id: eventId,
        action_source: "website",
        event_source_url: EVENT_SOURCE_URL,
        user_data: userData,
        custom_data: {
          currency: currency,
          value: Number(amountMajor.toFixed(2)),
          content_name: (data.product && data.product.name) || "Before You Resign - 30-Day Action Guide",
          content_type: "product",
          content_ids: [data.product_id || DEFAULT_PRODUCT_ID],
        },
      },
    ],
    access_token: token,
  };
  if (env.META_TEST_EVENT_CODE) {
    fbPayload.test_event_code = env.META_TEST_EVENT_CODE;
  }

  try {
    const fbRes = await fetch("https://graph.facebook.com/" + FB_API_VERSION + "/" + pixelId + "/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(fbPayload),
    });
    const fbText = await fbRes.text();
    console.log("polar-webhook: order", eventId, "-> Meta", fbRes.status, fbText.slice(0, 300));
    // 200 even on Meta errors so Polar doesn't retry; the error is logged for debugging.
    return json({ forwarded: fbRes.ok, fb_status: fbRes.status, event_id: eventId });
  } catch (err) {
    console.error("polar-webhook: Meta request failed", err && err.message);
    return json({ forwarded: false, error: "meta request failed" });
  }
}
