import assert from "node:assert/strict";
import { test } from "node:test";
import type { Database } from "@/lib/db";
import { sendSubscriptionInvoice } from "@/lib/invoice/send-subscription-invoice";

const params = {
  invoiceId: "00000000-0000-4000-8000-000000000001",
  tenantId: "00000000-0000-4000-8000-000000000002",
  paymentMethod: "HesabPay",
  transactionId: "test-transaction",
};

function fixture(overrides: Record<string, unknown> = {}) {
  const invoice = {
    id: params.invoiceId,
    tenantId: params.tenantId,
    status: "paid",
    invoiceNumber: "TEST-001",
    billingEmail: "owner@example.invalid",
    total: "100.00",
    currency: "AFN",
    items: [{ description: "Pro monthly" }],
    periodStart: "2026-10-01T00:00:00.000Z",
    periodEnd: "2026-11-01T00:00:00.000Z",
    createdAt: "2026-10-01T00:00:00.000Z",
    sentAt: null,
    pdfUrl: null,
    ...overrides,
  };
  let updates = 0;
  const database = {
    query: {
      invoices: { findFirst: async () => invoice },
      tenants: {
        findFirst: async () => ({ name: "Test store", slug: "test-store" }),
      },
      tenantMembers: { findFirst: async () => undefined },
    },
    update: () => ({
      set: () => ({
        where: async () => {
          updates++;
        },
      }),
    }),
  } as unknown as Database;
  return { database, updates: () => updates };
}

test("PDF generation failure remains retryable and does not send an email", async () => {
  const { database, updates } = fixture();
  let emailed = false;
  const result = await sendSubscriptionInvoice(params, {
    database,
    generatePdf: async () => ({ success: false, error: "PDF renderer failed" }),
    email: async () => {
      emailed = true;
      return { success: true, messageId: "fake" };
    },
  });
  assert.deepEqual(result, { success: false, error: "PDF renderer failed" });
  assert.equal(emailed, false);
  assert.equal(updates(), 0);
});

test("thrown PDF generation error remains retryable", async () => {
  const { database } = fixture();
  const result = await sendSubscriptionInvoice(params, {
    database,
    generatePdf: async () => {
      throw new Error("renderer crash");
    },
    email: async () => {
      assert.fail("Email must wait for PDF");
    },
  });
  assert.deepEqual(result, { success: false, error: "renderer crash" });
});

test("SMTP failure remains retryable and does not mark the invoice sent", async () => {
  const { database, updates } = fixture({ pdfUrl: "/already-stored.pdf" });
  const result = await sendSubscriptionInvoice(params, {
    database,
    generatePdf: async () => {
      assert.fail("Stored PDF must be reused");
    },
    email: async () => {
      throw new Error("SMTP unavailable");
    },
  });
  assert.deepEqual(result, { success: false, error: "SMTP unavailable" });
  assert.equal(updates(), 0);
});

test("slow PDF and SMTP are fully awaited by the worker sender", async () => {
  const { database, updates } = fixture();
  let releasePdf!: () => void;
  const pdfGate = new Promise<void>((resolve) => {
    releasePdf = resolve;
  });
  let releaseEmail!: () => void;
  const emailGate = new Promise<void>((resolve) => {
    releaseEmail = resolve;
  });
  let pdfStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    pdfStarted = resolve;
  });
  let emailStarted!: () => void;
  const emailSending = new Promise<void>((resolve) => {
    emailStarted = resolve;
  });

  const pending = sendSubscriptionInvoice(params, {
    database,
    generatePdf: async () => {
      pdfStarted();
      await pdfGate;
      return { success: true, pdfUrl: "/test.pdf" };
    },
    email: async () => {
      emailStarted();
      await emailGate;
      return { success: true, messageId: "fake" };
    },
  });
  await started;
  assert.equal(updates(), 0);
  releasePdf();
  await emailSending;
  assert.equal(updates(), 0);
  releaseEmail();
  assert.deepEqual(await pending, { success: true });
  assert.equal(updates(), 1);
});

test("a job for an unpaid invoice cannot produce a PDF or send mail", async () => {
  const { database } = fixture({ status: "unpaid" });
  const result = await sendSubscriptionInvoice(params, {
    database,
    generatePdf: async () => {
      assert.fail("Must not generate unpaid invoice");
    },
    email: async () => {
      assert.fail("Must not send unpaid invoice");
    },
  });
  assert.deepEqual(result, { success: false, error: "Invoice is not paid" });
});
