import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";
import { performance } from "node:perf_hooks";
import { HesabPayClient } from "@/lib/payments/hesabpay/client";
import type { HesabPayWebhookPayload } from "@/lib/payments/hesabpay/types";

const client = new HesabPayClient();
const originalFetch = globalThis.fetch;
const originalApiKey = process.env.HESABPAY_API_KEY;
const testApiKey = "dummy-kaka-malem-key-for-isolated-tests";
const denyNetwork: typeof fetch = async () => {
  throw new Error("Unexpected network access is forbidden in this test");
};

before(() => {
  // Never call the original fetch. Each test explicitly supplies its response.
  globalThis.fetch = denyNetwork;
  process.env.HESABPAY_API_KEY = testApiKey;
});
afterEach(() => {
  globalThis.fetch = denyNetwork;
  process.env.HESABPAY_API_KEY = testApiKey;
});
after(() => {
  globalThis.fetch = originalFetch;
  if (originalApiKey === undefined) delete process.env.HESABPAY_API_KEY;
  else process.env.HESABPAY_API_KEY = originalApiKey;
});

function notification(
  overrides: Partial<HesabPayWebhookPayload> = {}
): HesabPayWebhookPayload {
  return {
    status_code: 10,
    success: true,
    transaction_id: "isolated-test-transaction",
    amount: 100,
    signature: "original-JSON-signature",
    timestamp: Math.floor(Date.now() / 1000).toString(),
    session_id: "original-session",
    ...overrides,
  };
}

test("forwarded original JSON verifies without incoming headers using the unchanged app key", async () => {
  const payload = notification();
  let calls = 0;
  globalThis.fetch = async (input, options) => {
    calls++;
    assert.equal(
      input,
      "https://api.hesab.com/api/v1/hesab/webhooks/verify-signature"
    );
    assert.equal(options?.method, "POST");
    assert.equal(
      new Headers(options?.headers).get("Authorization"),
      `API-KEY ${testApiKey}`
    );
    assert.deepEqual(JSON.parse(String(options?.body)), {
      signature: payload.signature,
      timestamp: payload.timestamp,
    });
    assert.ok(options?.signal instanceof AbortSignal);
    return Response.json({ success: true });
  };
  const result = await client.verifyWebhook(payload, {}, "unused-relay-secret");
  assert.equal(calls, 1);
  assert.equal(result.valid, true);
  assert.equal(result.event?.rawPayload, payload);
  assert.equal(result.event?.eventType, "payment.success");
  assert.equal(process.env.HESABPAY_API_KEY, testApiKey);
});

test("a definitive invalid signature is rejected", async () => {
  globalThis.fetch = async () => Response.json({ success: false });
  const result = await client.verifyWebhook(notification(), {});
  assert.equal(result.valid, false);
  assert.equal(result.unavailable, undefined);
  assert.match(result.error || "", /Invalid webhook signature/);
});

for (const scenario of [
  {
    name: "5xx verifier response",
    response: async () => Response.json({ success: false }, { status: 503 }),
  },
  {
    name: "unreadable verifier JSON",
    response: async () => new Response("not JSON", { status: 200 }),
  },
  {
    name: "malformed verifier JSON",
    response: async () => Response.json({ success: "true" }),
  },
  {
    name: "verifier network failure",
    response: async () => {
      throw new Error("isolated network failure");
    },
  },
]) {
  test(`${scenario.name} is retryable and never accepted`, async () => {
    globalThis.fetch = scenario.response;
    const result = await client.verifyWebhook(notification(), {});
    assert.equal(result.valid, false);
    assert.equal(result.unavailable, true);
  });
}

test("a slow signature verifier is aborted within the relay budget", async () => {
  let aborted = false;
  globalThis.fetch = async (_input, options) =>
    new Promise<Response>((_resolve, reject) => {
      const signal = options?.signal;
      assert.ok(signal);
      signal.addEventListener(
        "abort",
        () => {
          aborted = true;
          reject(signal.reason);
        },
        { once: true }
      );
    });
  // AbortSignal.timeout uses an unreferenced timer; keep the isolated test alive.
  const keepAlive = setTimeout(() => {}, 5_000);
  const started = performance.now();
  try {
    const result = await client.verifyWebhook(notification(), {});
    const elapsed = performance.now() - started;
    assert.equal(aborted, true);
    assert.equal(result.valid, false);
    assert.equal(result.unavailable, true);
    assert.ok(
      elapsed >= 1_400,
      `Expected configured 1500ms timeout, got ${elapsed}ms`
    );
    assert.ok(elapsed < 4_000, `Verifier exceeded relay budget: ${elapsed}ms`);
  } finally {
    clearTimeout(keepAlive);
  }
});

for (const { name, ageSeconds } of [
  { name: "the observed 467-second provider delay", ageSeconds: 467 },
  { name: "exactly ten minutes old", ageSeconds: 600 },
  { name: "exactly one minute ahead", ageSeconds: -60 },
]) {
  test(
    name + " still requires verification of the original JSON",
    async (context) => {
      const now = 1_800_000_000_000;
      context.mock.method(Date, "now", () => now);
      const payload = notification({
        timestamp: String(now / 1000 - ageSeconds),
      });
      let calls = 0;
      globalThis.fetch = async (_input, options) => {
        calls++;
        assert.deepEqual(JSON.parse(String(options?.body)), {
          signature: payload.signature,
          timestamp: payload.timestamp,
        });
        return Response.json({ success: true });
      };
      assert.equal((await client.verifyWebhook(payload, {})).valid, true);
      assert.equal(calls, 1);
    }
  );
}

test("an eight-minute-old notification with an invalid signature remains rejected", async (context) => {
  const now = 1_800_000_000_000;
  context.mock.method(Date, "now", () => now);
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json({ success: false });
  };
  const result = await client.verifyWebhook(
    notification({ timestamp: String(now / 1000 - 467) }),
    {}
  );
  assert.equal(result.valid, false);
  assert.match(result.error || "", /Invalid webhook signature/);
  assert.equal(calls, 1);
});

test("stale, future, and malformed timestamps are rejected before verification network access", async (context) => {
  const now = 1_800_000_000_000;
  context.mock.method(Date, "now", () => now);
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    assert.fail("Timestamp rejection must happen before network access");
  };
  for (const timestamp of [
    String(now / 1000 - 601),
    String(now / 1000 + 61),
    `${now / 1000}trailing`,
  ]) {
    const result = await client.verifyWebhook(notification({ timestamp }), {});
    assert.equal(result.valid, false);
    assert.equal(result.unavailable, undefined);
    assert.match(result.error || "", /timestamp expired or invalid/);
  }
  assert.equal(calls, 0);
});

test("missing platform key is retryable without network access", async () => {
  delete process.env.HESABPAY_API_KEY;
  const result = await client.verifyWebhook(notification(), {});
  assert.equal(result.valid, false);
  assert.equal(result.unavailable, true);
  assert.match(result.error || "", /API key not configured/);
});

test("missing JSON signature is rejected even when an incoming header supplies one", async () => {
  const result = await client.verifyWebhook(notification({ signature: "" }), {
    "x-signature": "untrusted-header",
  });
  assert.equal(result.valid, false);
  assert.match(result.error || "", /Missing signature or timestamp/);
});

test("created session records the exact rounded AFN sum sent to HesabPay", async () => {
  const reference = "00000000-0000-4000-8000-000000000001";
  globalThis.fetch = async (_input, options) => {
    const payload = JSON.parse(String(options?.body));
    assert.deepEqual(payload.items, [
      { id: reference, name: "First", price: 11 },
      { id: reference, name: "Second", price: 21 },
    ]);
    return Response.json({
      success: true,
      session_id: "local-session",
      url: "https://checkout.example.invalid/local-session",
    });
  };
  const result = await client.createPaymentSession(
    {
      tenantId: "00000000-0000-4000-8000-000000000002",
      orderId: reference,
      amount: 31.7,
      currency: "AFN",
      successUrl: "https://example.invalid/success",
      cancelUrl: "https://example.invalid/cancel",
      items: [
        { name: "First", unitPrice: 10.6, quantity: 1 },
        { name: "Second", unitPrice: 7.03, quantity: 3 },
      ],
    },
    { apiKey: testApiKey, isLive: false }
  );
  assert.equal(result.success, true);
  assert.equal(result.chargedAmount, 32);
});
