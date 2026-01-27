import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { computePaymentStatus } from "@/lib/utils/payment-status";

// Use built-in Helvetica font for reliability (no network requests)
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#1f2937",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  storeName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 4,
  },
  storeInfo: {
    fontSize: 9,
    color: "#6b7280",
    lineHeight: 1.4,
  },
  invoiceTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#7c3aed",
    textAlign: "right",
  },
  invoiceNumber: {
    fontSize: 10,
    color: "#6b7280",
    textAlign: "right",
    marginTop: 4,
  },
  invoiceDate: {
    fontSize: 10,
    color: "#6b7280",
    textAlign: "right",
    marginTop: 2,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#374151",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  addressBlock: {
    backgroundColor: "#f9fafb",
    padding: 12,
    borderRadius: 4,
    flex: 1,
    marginRight: 10,
  },
  addressBlockLast: {
    marginRight: 0,
  },
  addressTitle: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#6b7280",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  addressText: {
    fontSize: 10,
    color: "#374151",
    lineHeight: 1.5,
  },
  table: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    padding: 10,
    borderRadius: 4,
    marginBottom: 4,
  },
  tableHeaderText: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#374151",
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  tableCell: {
    fontSize: 10,
    color: "#374151",
  },
  tableCellProduct: {
    flex: 3,
  },
  tableCellQty: {
    flex: 1,
    textAlign: "center",
  },
  tableCellPrice: {
    flex: 1.5,
    textAlign: "right",
  },
  tableCellTotal: {
    flex: 1.5,
    textAlign: "right",
  },
  variantText: {
    fontSize: 9,
    color: "#6b7280",
    marginTop: 2,
  },
  totalsSection: {
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 6,
  },
  totalsLabel: {
    fontSize: 10,
    color: "#6b7280",
    width: 120,
    textAlign: "right",
  },
  totalsValue: {
    fontSize: 10,
    color: "#374151",
    width: 100,
    textAlign: "right",
  },
  totalsFinal: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 2,
    borderTopColor: "#7c3aed",
  },
  totalsFinalLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#111827",
    width: 120,
    textAlign: "right",
  },
  totalsFinalValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#7c3aed",
    width: 100,
    textAlign: "right",
  },
  paymentStatus: {
    marginTop: 15,
    padding: 10,
    borderRadius: 4,
    textAlign: "center",
  },
  paymentStatusPaid: {
    backgroundColor: "#dcfce7",
  },
  paymentStatusUnpaid: {
    backgroundColor: "#fef3c7",
  },
  paymentStatusRefunded: {
    backgroundColor: "#fee2e2",
  },
  paymentStatusPartialRefund: {
    backgroundColor: "#ffedd5",
  },
  paymentStatusText: {
    fontSize: 11,
    fontWeight: "bold",
  },
  paymentStatusTextPaid: {
    color: "#166534",
  },
  paymentStatusTextUnpaid: {
    color: "#92400e",
  },
  paymentStatusTextRefunded: {
    color: "#b91c1c",
  },
  paymentStatusTextPartialRefund: {
    color: "#c2410c",
  },
  footer: {
    position: "absolute",
    bottom: 40,
    left: 40,
    right: 40,
    textAlign: "center",
  },
  footerText: {
    fontSize: 9,
    color: "#9ca3af",
    marginBottom: 4,
  },
  footerThankYou: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#7c3aed",
    marginTop: 10,
  },
  notesSection: {
    marginTop: 20,
    padding: 12,
    backgroundColor: "#f9fafb",
    borderRadius: 4,
  },
  notesTitle: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#6b7280",
    marginBottom: 4,
  },
  notesText: {
    fontSize: 10,
    color: "#374151",
  },
});

// GPS-based address type for Afghan market
type GpsAddress = {
  firstName?: string;
  lastName?: string;
  city?: string;
  notes?: string;
  phone?: string;
  coordinates?: string;
  plusCode?: string;
};

export interface InvoiceData {
  // Store info
  store: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    logoUrl?: string;
    footerText?: string;
  };
  // Order info
  order: {
    id: string;
    orderNumber: string;
    placedAt: string;
    channel: string;
    paymentStatus: string;
    customerNotes?: string;
    // Customer
    customer: {
      name: string;
      email: string;
      phone?: string;
    };
    // GPS-based addresses (Afghan market)
    shippingAddress?: GpsAddress;
    billingAddress?: GpsAddress;
    // Items
    items: Array<{
      productName: string;
      variantName?: string;
      sku?: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }>;
    // Totals
    subtotal: number;
    shippingTotal: number;
    taxTotal: number;
    discountTotal: number;
    total: number;
    amountPaid: number;
    amountRefunded: number;
    amountDue: number;
    currency: string;
  };
}

function formatCurrency(amount: number, currency: string): string {
  if (currency === "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  }
  // AFN - Afghan Afghani
  return `AFN ${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)}`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatAddress(address?: GpsAddress): string {
  if (!address) return "N/A";
  const parts = [];
  if (address.firstName || address.lastName) {
    parts.push([address.firstName, address.lastName].filter(Boolean).join(" "));
  }
  if (address.city) parts.push(address.city);
  if (address.plusCode) parts.push(`Plus Code: ${address.plusCode}`);
  if (address.coordinates) parts.push(`GPS: ${address.coordinates}`);
  if (address.notes) parts.push(address.notes);
  if (address.phone) parts.push(`Tel: ${address.phone}`);
  return parts.join("\n") || "N/A";
}

export function InvoiceDocument({ data }: { data: InvoiceData }) {
  const { store, order } = data;

  // Compute payment status using the utility for consistency
  const paymentInfo = computePaymentStatus({
    total: order.total,
    amountPaid: order.amountPaid,
    amountRefunded: order.amountRefunded,
  });
  const { isPaid, isFullyRefunded, isPartiallyRefunded } = paymentInfo;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.storeName}>{store.name}</Text>
            <Text style={styles.storeInfo}>
              {[store.email, store.phone, store.address]
                .filter(Boolean)
                .join(" | ")}
            </Text>
          </View>
          <View>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <Text style={styles.invoiceNumber}>#{order.orderNumber}</Text>
            <Text style={styles.invoiceDate}>{formatDate(order.placedAt)}</Text>
          </View>
        </View>

        {/* Addresses */}
        <View style={[styles.section, { flexDirection: "row" }]}>
          <View style={styles.addressBlock}>
            <Text style={styles.addressTitle}>Bill To</Text>
            <Text style={styles.addressText}>{order.customer.name}</Text>
            <Text style={styles.addressText}>{order.customer.email}</Text>
            {order.customer.phone && (
              <Text style={styles.addressText}>{order.customer.phone}</Text>
            )}
            {order.billingAddress && (
              <Text style={[styles.addressText, { marginTop: 4 }]}>
                {formatAddress(order.billingAddress)}
              </Text>
            )}
          </View>
          {order.shippingAddress && (
            <View style={[styles.addressBlock, styles.addressBlockLast]}>
              <Text style={styles.addressTitle}>Ship To</Text>
              <Text style={styles.addressText}>
                {formatAddress(order.shippingAddress)}
              </Text>
            </View>
          )}
        </View>

        {/* Items Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Items</Text>
          <View style={styles.table}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.tableCellProduct]}>
                Product
              </Text>
              <Text style={[styles.tableHeaderText, styles.tableCellQty]}>
                Qty
              </Text>
              <Text style={[styles.tableHeaderText, styles.tableCellPrice]}>
                Price
              </Text>
              <Text style={[styles.tableHeaderText, styles.tableCellTotal]}>
                Total
              </Text>
            </View>
            {/* Table Rows */}
            {order.items.map((item, index) => (
              <View style={styles.tableRow} key={index}>
                <View style={styles.tableCellProduct}>
                  <Text style={styles.tableCell}>{item.productName}</Text>
                  {item.variantName && (
                    <Text style={styles.variantText}>{item.variantName}</Text>
                  )}
                  {item.sku && (
                    <Text style={styles.variantText}>SKU: {item.sku}</Text>
                  )}
                </View>
                <Text style={[styles.tableCell, styles.tableCellQty]}>
                  {item.quantity}
                </Text>
                <Text style={[styles.tableCell, styles.tableCellPrice]}>
                  {formatCurrency(item.unitPrice, order.currency)}
                </Text>
                <Text style={[styles.tableCell, styles.tableCellTotal]}>
                  {formatCurrency(item.lineTotal, order.currency)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal:</Text>
            <Text style={styles.totalsValue}>
              {formatCurrency(order.subtotal, order.currency)}
            </Text>
          </View>
          {order.shippingTotal > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Shipping:</Text>
              <Text style={styles.totalsValue}>
                {formatCurrency(order.shippingTotal, order.currency)}
              </Text>
            </View>
          )}
          {order.taxTotal > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Tax:</Text>
              <Text style={styles.totalsValue}>
                {formatCurrency(order.taxTotal, order.currency)}
              </Text>
            </View>
          )}
          {order.discountTotal > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Discount:</Text>
              <Text style={styles.totalsValue}>
                -{formatCurrency(order.discountTotal, order.currency)}
              </Text>
            </View>
          )}
          <View style={styles.totalsFinal}>
            <Text style={styles.totalsFinalLabel}>Total:</Text>
            <Text style={styles.totalsFinalValue}>
              {formatCurrency(order.total, order.currency)}
            </Text>
          </View>
        </View>

        {/* Payment Status */}
        <View
          style={[
            styles.paymentStatus,
            isFullyRefunded
              ? styles.paymentStatusRefunded
              : isPartiallyRefunded
                ? styles.paymentStatusPartialRefund
                : isPaid
                  ? styles.paymentStatusPaid
                  : styles.paymentStatusUnpaid,
          ]}
        >
          <Text
            style={[
              styles.paymentStatusText,
              isFullyRefunded
                ? styles.paymentStatusTextRefunded
                : isPartiallyRefunded
                  ? styles.paymentStatusTextPartialRefund
                  : isPaid
                    ? styles.paymentStatusTextPaid
                    : styles.paymentStatusTextUnpaid,
            ]}
          >
            {isFullyRefunded
              ? "REFUNDED"
              : isPartiallyRefunded
                ? `PARTIALLY REFUNDED (${formatCurrency(order.amountRefunded, order.currency)})`
                : isPaid
                  ? "PAID"
                  : `Amount Due: ${formatCurrency(order.amountDue, order.currency)}`}
          </Text>
        </View>

        {/* Notes */}
        {order.customerNotes && (
          <View style={styles.notesSection}>
            <Text style={styles.notesTitle}>ORDER NOTES</Text>
            <Text style={styles.notesText}>{order.customerNotes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          {store.footerText && (
            <Text style={styles.footerText}>{store.footerText}</Text>
          )}
          <Text style={styles.footerText}>
            Questions? Contact us at {store.email || store.phone || store.name}
          </Text>
          <Text style={styles.footerThankYou}>Thank you for your order!</Text>
        </View>
      </Page>
    </Document>
  );
}
