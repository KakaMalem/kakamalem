import { notFound } from "next/navigation";
import { Metadata } from "next";
import Link from "next/link";
import { getOrderFromToken, getOrderForInvoice } from "@/lib/invoice";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import {
  InvoiceActions,
  InvoiceShareActions,
} from "@/components/invoice/invoice-actions";
import { computePaymentStatus } from "@/lib/utils/payment-status";

export const metadata: Metadata = {
  title: "Invoice",
  description: "View your invoice",
};

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function PublicInvoicePage({ params }: PageProps) {
  const { token } = await params;

  // Validate token and get order info
  const tokenData = await getOrderFromToken(token);
  if (!tokenData) {
    notFound();
  }

  // Get invoice data
  const invoiceData = await getOrderForInvoice(
    tokenData.orderId,
    tokenData.tenantId
  );
  if (!invoiceData) {
    notFound();
  }

  const { store, order } = invoiceData;

  // Compute payment status using the utility for consistency
  const paymentInfo = computePaymentStatus({
    total: order.total,
    amountPaid: order.amountPaid,
    amountRefunded: order.amountRefunded,
  });
  const { isPaid, isFullyRefunded, isPartiallyRefunded } = paymentInfo;

  function formatCurrency(amount: number): string {
    if (order.currency === "USD") {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(amount);
    }
    return `AFN ${new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)}`;
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function formatAddress(address?: {
    firstName?: string;
    lastName?: string;
    city?: string;
    notes?: string;
    phone?: string;
    coordinates?: string;
    plusCode?: string;
  }): string[] {
    if (!address) return ["N/A"];
    const lines: string[] = [];
    if (address.firstName || address.lastName) {
      lines.push(
        [address.firstName, address.lastName].filter(Boolean).join(" ")
      );
    }
    if (address.city) lines.push(address.city);
    if (address.plusCode) lines.push(`Plus Code: ${address.plusCode}`);
    if (address.coordinates) lines.push(`GPS: ${address.coordinates}`);
    if (address.notes) lines.push(address.notes);
    if (address.phone) lines.push(`Tel: ${address.phone}`);
    return lines.length > 0 ? lines : ["N/A"];
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 print:bg-white print:py-0">
      <div className="mx-auto max-w-4xl px-4 print:max-w-none print:px-0">
        {/* Action Bar */}
        <div className="mb-6 flex items-center justify-between print:hidden">
          <Link
            href={`/store/${store.name.toLowerCase().replace(/\s+/g, "-")}`}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Store
          </Link>
          <InvoiceActions token={token} orderNumber={order.orderNumber} />
        </div>

        {/* Invoice Card */}
        <Card className="shadow-lg print:border-none print:shadow-none">
          <CardContent className="p-8">
            {/* Header */}
            <div className="mb-8 flex items-start justify-between border-b pb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {store.name}
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                  {[store.email, store.phone].filter(Boolean).join(" | ")}
                </p>
              </div>
              <div className="text-right">
                <h2 className="text-3xl font-bold text-violet-600">INVOICE</h2>
                <p className="mt-1 text-sm text-gray-500">
                  #{order.orderNumber}
                </p>
                <p className="text-sm text-gray-500">
                  {formatDate(order.placedAt)}
                </p>
              </div>
            </div>

            {/* Addresses */}
            <div className="mb-8 grid gap-6 md:grid-cols-2">
              <div className="rounded-lg bg-gray-50 p-4">
                <h3 className="mb-2 text-xs font-semibold uppercase text-gray-500">
                  Bill To
                </h3>
                <p className="font-medium text-gray-900">
                  {order.customer.name}
                </p>
                <p className="text-sm text-gray-600">{order.customer.email}</p>
                {order.customer.phone && (
                  <p className="text-sm text-gray-600">
                    {order.customer.phone}
                  </p>
                )}
                {order.billingAddress && (
                  <div className="mt-2">
                    {formatAddress(order.billingAddress).map((line, i) => (
                      <p key={i} className="text-sm text-gray-600">
                        {line}
                      </p>
                    ))}
                  </div>
                )}
              </div>
              {order.shippingAddress && (
                <div className="rounded-lg bg-gray-50 p-4">
                  <h3 className="mb-2 text-xs font-semibold uppercase text-gray-500">
                    Ship To
                  </h3>
                  {formatAddress(order.shippingAddress).map((line, i) => (
                    <p key={i} className="text-sm text-gray-600">
                      {line}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* Items Table */}
            <div className="mb-8">
              <h3 className="mb-4 text-sm font-semibold uppercase text-gray-500">
                Order Items
              </h3>
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                        Product
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-gray-500">
                        Qty
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">
                        Price
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {order.items.map((item, index) => (
                      <tr key={index}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">
                            {item.productName}
                          </p>
                          {item.variantName && (
                            <p className="text-sm text-gray-500">
                              {item.variantName}
                            </p>
                          )}
                          {item.sku && (
                            <p className="text-xs text-gray-400">
                              SKU: {item.sku}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-600">
                          {item.quantity}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {formatCurrency(item.unitPrice)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">
                          {formatCurrency(item.lineTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="mb-8 flex justify-end">
              <div className="w-72 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="text-gray-900">
                    {formatCurrency(order.subtotal)}
                  </span>
                </div>
                {order.shippingTotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Shipping</span>
                    <span className="text-gray-900">
                      {formatCurrency(order.shippingTotal)}
                    </span>
                  </div>
                )}
                {order.taxTotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Tax</span>
                    <span className="text-gray-900">
                      {formatCurrency(order.taxTotal)}
                    </span>
                  </div>
                )}
                {order.discountTotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Discount</span>
                    <span className="text-green-600">
                      -{formatCurrency(order.discountTotal)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t-2 border-violet-600 pt-2">
                  <span className="text-lg font-bold text-gray-900">Total</span>
                  <span className="text-lg font-bold text-violet-600">
                    {formatCurrency(order.total)}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment Status */}
            <div
              className={`mb-8 rounded-lg p-4 text-center ${
                isFullyRefunded
                  ? "bg-red-50"
                  : isPartiallyRefunded
                    ? "bg-orange-50"
                    : isPaid
                      ? "bg-green-50"
                      : "bg-amber-50"
              }`}
            >
              <p
                className={`font-semibold ${
                  isFullyRefunded
                    ? "text-red-700"
                    : isPartiallyRefunded
                      ? "text-orange-700"
                      : isPaid
                        ? "text-green-700"
                        : "text-amber-700"
                }`}
              >
                {isFullyRefunded
                  ? "REFUNDED"
                  : isPartiallyRefunded
                    ? `PARTIALLY REFUNDED (${formatCurrency(order.amountRefunded)})`
                    : isPaid
                      ? "PAID"
                      : `Amount Due: ${formatCurrency(order.amountDue)}`}
              </p>
            </div>

            {/* Notes */}
            {order.customerNotes && (
              <div className="mb-8 rounded-lg bg-gray-50 p-4">
                <h3 className="mb-2 text-xs font-semibold uppercase text-gray-500">
                  Order Notes
                </h3>
                <p className="text-sm text-gray-600">{order.customerNotes}</p>
              </div>
            )}

            {/* Footer */}
            <div className="border-t pt-6 text-center">
              {store.footerText && (
                <p className="mb-2 text-sm text-gray-500">{store.footerText}</p>
              )}
              <p className="text-sm text-gray-500">
                Questions? Contact us at{" "}
                {store.email || store.phone || store.name}
              </p>
              <p className="mt-4 font-semibold text-violet-600">
                Thank you for your order!
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Share Options */}
        <InvoiceShareActions orderNumber={order.orderNumber} />
      </div>
    </div>
  );
}
