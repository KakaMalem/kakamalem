import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import path from "path";

// Register Vazirmatn for Persian support
Font.register({
  family: "Vazirmatn",
  fonts: [
    {
      src: path.join(process.cwd(), "public", "fonts", "Vazirmatn-Regular.ttf"),
    },
    {
      src: path.join(process.cwd(), "public", "fonts", "Vazirmatn-Bold.ttf"),
      fontWeight: "bold",
    },
  ],
});

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Vazirmatn",
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
  platformName: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#7c3aed",
    marginBottom: 4,
  },
  platformInfo: {
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
  addressRow: {
    flexDirection: "row",
    gap: 20,
  },
  addressBlock: {
    backgroundColor: "#f9fafb",
    padding: 12,
    borderRadius: 4,
    flex: 1,
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
  periodSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#f3f0ff",
    padding: 12,
    borderRadius: 4,
    marginBottom: 20,
  },
  periodLabel: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#6b7280",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  periodValue: {
    fontSize: 11,
    color: "#374151",
    fontWeight: "bold",
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
  tableCellDesc: {
    flex: 4,
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
  paymentInfo: {
    marginTop: 15,
    padding: 12,
    backgroundColor: "#f9fafb",
    borderRadius: 4,
  },
  paymentInfoTitle: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#6b7280",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  paymentInfoRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  paymentInfoLabel: {
    fontSize: 9,
    color: "#6b7280",
    width: 100,
  },
  paymentInfoValue: {
    fontSize: 9,
    color: "#374151",
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
});

export interface SubscriptionInvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  buyer: {
    name: string;
    email?: string;
    phone?: string;
    storeName: string;
  };
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  tax: number;
  total: number;
  paidAmount: number;
  currency: string;
  paymentMethod?: string;
  transactionId?: string;
  paidAt?: string;
}

function formatCurrency(amount: number, currency: string): string {
  if (currency === "USD" || currency === "USDT" || currency === "USDC") {
    return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `؋ ${amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function SubscriptionInvoiceDocument({
  data,
}: {
  data: SubscriptionInvoiceData;
}) {
  const isPaid = data.status === "paid";
  const amountDue = data.total - data.paidAmount;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.platformName}>Kaka Malem</Text>
            <Text style={styles.platformInfo}>kakamalem.com</Text>
            <Text style={styles.platformInfo}>kakamalem.team@gmail.com</Text>
          </View>
          <View>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <Text style={styles.invoiceNumber}>#{data.invoiceNumber}</Text>
            <Text style={styles.invoiceDate}>
              {formatDate(data.invoiceDate)}
            </Text>
          </View>
        </View>

        {/* Bill To */}
        <View style={[styles.section, styles.addressRow]}>
          <View style={styles.addressBlock}>
            <Text style={styles.addressTitle}>Bill To</Text>
            <Text style={styles.addressText}>{data.buyer.name}</Text>
            {data.buyer.email && (
              <Text style={styles.addressText}>{data.buyer.email}</Text>
            )}
            {data.buyer.phone && (
              <Text style={styles.addressText}>{data.buyer.phone}</Text>
            )}
            <Text style={[styles.addressText, { marginTop: 4 }]}>
              Store: {data.buyer.storeName}
            </Text>
          </View>
        </View>

        {/* Billing Period */}
        <View style={styles.periodSection}>
          <View>
            <Text style={styles.periodLabel}>Period Start</Text>
            <Text style={styles.periodValue}>
              {formatDate(data.periodStart)}
            </Text>
          </View>
          <View>
            <Text style={styles.periodLabel}>Period End</Text>
            <Text style={styles.periodValue}>{formatDate(data.periodEnd)}</Text>
          </View>
        </View>

        {/* Items Table */}
        <View style={styles.section}>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.tableCellDesc]}>
                Description
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
            {data.items.map((item, index) => (
              <View style={styles.tableRow} key={index}>
                <Text style={[styles.tableCell, styles.tableCellDesc]}>
                  {item.description}
                </Text>
                <Text style={[styles.tableCell, styles.tableCellQty]}>
                  {item.quantity}
                </Text>
                <Text style={[styles.tableCell, styles.tableCellPrice]}>
                  {formatCurrency(item.unitPrice, data.currency)}
                </Text>
                <Text style={[styles.tableCell, styles.tableCellTotal]}>
                  {formatCurrency(item.total, data.currency)}
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
              {formatCurrency(data.subtotal, data.currency)}
            </Text>
          </View>
          {data.tax > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Tax:</Text>
              <Text style={styles.totalsValue}>
                {formatCurrency(data.tax, data.currency)}
              </Text>
            </View>
          )}
          <View style={styles.totalsFinal}>
            <Text style={styles.totalsFinalLabel}>Total:</Text>
            <Text style={styles.totalsFinalValue}>
              {formatCurrency(data.total, data.currency)}
            </Text>
          </View>
        </View>

        {/* Payment Status */}
        <View
          style={[
            styles.paymentStatus,
            isPaid ? styles.paymentStatusPaid : styles.paymentStatusUnpaid,
          ]}
        >
          <Text
            style={[
              styles.paymentStatusText,
              isPaid
                ? styles.paymentStatusTextPaid
                : styles.paymentStatusTextUnpaid,
            ]}
          >
            {isPaid
              ? "PAID"
              : `Amount Due: ${formatCurrency(amountDue, data.currency)}`}
          </Text>
        </View>

        {/* Payment Details */}
        {data.paymentMethod && (
          <View style={styles.paymentInfo}>
            <Text style={styles.paymentInfoTitle}>Payment Details</Text>
            <View style={styles.paymentInfoRow}>
              <Text style={styles.paymentInfoLabel}>Method:</Text>
              <Text style={styles.paymentInfoValue}>{data.paymentMethod}</Text>
            </View>
            {data.transactionId && (
              <View style={styles.paymentInfoRow}>
                <Text style={styles.paymentInfoLabel}>Transaction ID:</Text>
                <Text style={styles.paymentInfoValue}>
                  {data.transactionId}
                </Text>
              </View>
            )}
            {data.paidAt && (
              <View style={styles.paymentInfoRow}>
                <Text style={styles.paymentInfoLabel}>Paid On:</Text>
                <Text style={styles.paymentInfoValue}>
                  {formatDate(data.paidAt)}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Questions? Contact us at kakamalem.team@gmail.com
          </Text>
          <Text style={styles.footerThankYou}>
            Thank you for choosing Kaka Malem!
          </Text>
        </View>
      </Page>
    </Document>
  );
}
