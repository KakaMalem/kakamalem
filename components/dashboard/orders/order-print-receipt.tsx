import type { DashboardOrderDetail } from "@/lib/db/queries/orders";

interface ReceiptSettings {
  paperWidth: string;
  showLogo: boolean;
  showContact: boolean;
  footerText: string | null;
}

interface OrderPrintReceiptProps {
  order: DashboardOrderDetail;
  storeName: string;
  storeLogo?: string | null;
  storePhone?: string | null;
  storeEmail?: string | null;
  currency: string;
  receiptSettings?: ReceiptSettings;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  mobile_money: "Mobile Money",
  bank_transfer: "Bank Transfer",
};

// Shorter labels for 58mm paper
const PAYMENT_METHOD_LABELS_SHORT: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  mobile_money: "Mobile",
  bank_transfer: "Transfer",
};

const DEFAULT_FOOTER = "Thank you for your purchase!";

export function OrderPrintReceipt({
  order,
  storeName,
  storeLogo,
  storePhone,
  storeEmail,
  currency,
  receiptSettings,
}: OrderPrintReceiptProps) {
  // Default settings
  const paperWidth = receiptSettings?.paperWidth || "80mm";
  const showLogo = receiptSettings?.showLogo ?? true;
  const showContact = receiptSettings?.showContact ?? true;
  const footerText = receiptSettings?.footerText || DEFAULT_FOOTER;

  // Compact mode for 58mm paper
  const isCompact = paperWidth === "58mm";

  const formatPrice = (price: string | number) => {
    const num = typeof price === "string" ? parseFloat(price) : price;
    return `${num.toLocaleString()} ${currency}`;
  };

  // Shorter price format for compact mode (no space before currency)
  const formatPriceCompact = (price: string | number) => {
    const num = typeof price === "string" ? parseFloat(price) : price;
    return `${num.toLocaleString()}${currency}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    if (isCompact) {
      // Shorter date format for 58mm
      return date.toLocaleDateString("en-US", {
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    }
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  // Truncate text for compact mode
  const truncate = (text: string, maxLength: number) => {
    if (!isCompact || text.length <= maxLength) return text;
    return text.slice(0, maxLength - 1) + "…";
  };

  // Dynamic width class based on paper size
  const widthClass = isCompact ? "max-w-[58mm]" : "max-w-[80mm]";
  // Spacing classes
  const sectionSpacing = isCompact ? "mb-2" : "mb-4";
  const itemSpacing = isCompact ? "space-y-1" : "space-y-2";

  return (
    <div className="print-only">
      <div
        className={`print-receipt mx-auto bg-white ${isCompact ? "p-2" : "p-4"} ${widthClass}`}
        data-paper-width={paperWidth}
      >
        {/* Header */}
        <div className={`${sectionSpacing} text-center`}>
          {showLogo && storeLogo && !isCompact && (
            // eslint-disable-next-line @next/next/no-img-element -- Using img for print compatibility
            <img
              src={storeLogo}
              alt={storeName}
              className="mx-auto mb-2 h-12 object-contain"
            />
          )}
          {/* Smaller logo for compact mode */}
          {showLogo && storeLogo && isCompact && (
            // eslint-disable-next-line @next/next/no-img-element -- Using img for print compatibility
            <img
              src={storeLogo}
              alt={storeName}
              className="mx-auto mb-1 h-8 object-contain"
            />
          )}
          <h1
            className={isCompact ? "text-base font-bold" : "text-lg font-bold"}
          >
            {truncate(storeName, 20)}
          </h1>
          {showContact && !isCompact && (
            <>
              {storePhone && (
                <p className="text-sm text-muted-foreground">{storePhone}</p>
              )}
              {storeEmail && (
                <p className="text-sm text-muted-foreground">{storeEmail}</p>
              )}
            </>
          )}
          {/* Only phone on compact */}
          {showContact && isCompact && storePhone && (
            <p className="text-xs text-muted-foreground">{storePhone}</p>
          )}
        </div>

        {/* Divider */}
        <div className={`${sectionSpacing} border-b border-dashed`} />

        {/* Receipt info */}
        <div className={`${sectionSpacing} space-y-0.5 text-sm`}>
          {isCompact ? (
            // Compact: stacked layout
            <>
              <div className="text-center">
                <span className="font-medium">
                  #{order.receiptNumber || order.orderNumber}
                </span>
              </div>
              <div className="text-center text-xs text-muted-foreground">
                {formatDate(order.createdAt)}
              </div>
            </>
          ) : (
            // Standard: side-by-side layout
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Receipt #</span>
                <span className="font-medium">
                  {order.receiptNumber || order.orderNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date</span>
                <span>{formatDate(order.createdAt)}</span>
              </div>
              {order.customerSnapshot.name &&
                order.customerSnapshot.name !== "Walk-in Customer" && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Customer</span>
                    <span>{order.customerSnapshot.name}</span>
                  </div>
                )}
            </>
          )}
        </div>

        {/* Divider */}
        <div className={`${sectionSpacing} border-b border-dashed`} />

        {/* Items */}
        <div className={`${sectionSpacing} ${itemSpacing}`}>
          {order.items.map((item) => (
            <div key={item.id} className={isCompact ? "text-xs" : "text-sm"}>
              {isCompact ? (
                // Compact: stacked layout - name on top, qty x price on bottom
                <>
                  <div className="font-medium">
                    {truncate(item.productName, 24)}
                    {item.variantName && (
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        ({truncate(item.variantName, 10)})
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>
                      {item.quantity} x {formatPriceCompact(item.price)}
                    </span>
                    <span className="font-medium text-foreground">
                      {formatPriceCompact(
                        parseFloat(item.price) * item.quantity
                      )}
                    </span>
                  </div>
                </>
              ) : (
                // Standard: side-by-side layout
                <>
                  <div className="flex justify-between">
                    <span className="flex-1">
                      {item.quantity}x {item.productName}
                      {item.variantName && (
                        <span className="text-muted-foreground">
                          {" "}
                          ({item.variantName})
                        </span>
                      )}
                    </span>
                    <span className="ml-2 shrink-0">
                      {formatPrice(parseFloat(item.price) * item.quantity)}
                    </span>
                  </div>
                  {item.quantity > 1 && (
                    <div className="text-xs text-muted-foreground">
                      @ {formatPrice(item.price)} each
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className={`${sectionSpacing} border-b border-dashed`} />

        {/* Totals */}
        <div
          className={`${sectionSpacing} space-y-0.5 ${isCompact ? "text-xs" : "text-sm"}`}
        >
          {!isCompact && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatPrice(order.subtotal)}</span>
            </div>
          )}
          {parseFloat(order.shippingTotal) > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {isCompact ? "Ship" : "Shipping"}
              </span>
              <span>
                {isCompact
                  ? formatPriceCompact(order.shippingTotal)
                  : formatPrice(order.shippingTotal)}
              </span>
            </div>
          )}
          {parseFloat(order.discountTotal) > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {isCompact ? "Disc" : "Discount"}
              </span>
              <span>
                -
                {isCompact
                  ? formatPriceCompact(order.discountTotal)
                  : formatPrice(order.discountTotal)}
              </span>
            </div>
          )}
          <div
            className={`flex justify-between ${isCompact ? "pt-1 text-sm" : "pt-2 text-base"} font-bold`}
          >
            <span>Total</span>
            <span>
              {isCompact
                ? formatPriceCompact(order.total)
                : formatPrice(order.total)}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className={`${sectionSpacing} border-b border-dashed`} />

        {/* Payment info */}
        {(() => {
          const totalPaid = parseFloat(order.totalPaid || "0");
          const amountRemaining = parseFloat(order.amountRemaining || "0");
          const orderTotal = parseFloat(order.total);
          const isPartialPayment = totalPaid > 0 && !order.isPaid;
          const hasPayments = order.payments && order.payments.length > 0;

          return (
            <div
              className={`${sectionSpacing} ${isCompact ? "text-xs" : "text-sm"}`}
            >
              {/* Payment Status */}
              {order.isPaid ? (
                // Fully Paid
                <div className="text-center">
                  <p className="font-bold">** PAID **</p>
                  {/* Show payment method(s) */}
                  {hasPayments && order.payments.length === 1 && (
                    <p className="text-muted-foreground">
                      {isCompact
                        ? PAYMENT_METHOD_LABELS_SHORT[
                            order.payments[0].paymentMethod
                          ] || order.payments[0].paymentMethod
                        : PAYMENT_METHOD_LABELS[
                            order.payments[0].paymentMethod
                          ] || order.payments[0].paymentMethod}
                    </p>
                  )}
                  {/* For legacy orders without payment records, show the order payment method */}
                  {!hasPayments && order.paymentMethod && (
                    <p className="text-muted-foreground">
                      {isCompact
                        ? PAYMENT_METHOD_LABELS_SHORT[order.paymentMethod] ||
                          order.paymentMethod
                        : PAYMENT_METHOD_LABELS[order.paymentMethod] ||
                          order.paymentMethod}
                    </p>
                  )}
                </div>
              ) : isPartialPayment ? (
                // Partial Payment
                <div className="space-y-1">
                  <p className="text-center font-bold">** PARTIAL **</p>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {isCompact ? "Paid" : "Amount Paid"}
                    </span>
                    <span className="font-medium">
                      {isCompact
                        ? formatPriceCompact(totalPaid)
                        : formatPrice(totalPaid)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {isCompact ? "Due" : "Balance Due"}
                    </span>
                    <span className="font-medium">
                      {isCompact
                        ? formatPriceCompact(amountRemaining)
                        : formatPrice(amountRemaining)}
                    </span>
                  </div>
                </div>
              ) : (
                // Unpaid
                <div className="text-center">
                  <p className="font-bold">** UNPAID **</p>
                  <p className="text-muted-foreground">
                    {isCompact ? "Due" : "Amount Due"}:{" "}
                    <span className="font-medium">
                      {isCompact
                        ? formatPriceCompact(orderTotal)
                        : formatPrice(orderTotal)}
                    </span>
                  </p>
                </div>
              )}
            </div>
          );
        })()}

        {/* Footer */}
        <div
          className={`text-center ${isCompact ? "text-[10px]" : "text-xs"} text-muted-foreground`}
        >
          <p className="font-medium">
            {isCompact ? truncate(footerText, 28) : footerText}
          </p>
          {!isCompact && (
            <p className="mt-2">
              {order.salesChannel === "phone"
                ? "Phone Order"
                : order.salesChannel === "offline"
                  ? "In-Store Sale"
                  : "Online Order"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
