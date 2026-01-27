import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/lib/db/queries/tenants";
import { getDashboardOrderById } from "@/lib/db/queries/orders";
import { OrderPrintReceipt } from "@/components/dashboard/orders/order-print-receipt";

interface PrintPageProps {
  params: Promise<{ slug: string; orderId: string }>;
}

export default async function OrderPrintPage({ params }: PrintPageProps) {
  const { slug, orderId } = await params;

  const store = await getTenantBySlug(slug);
  if (!store) {
    notFound();
  }

  const order = await getDashboardOrderById(store.id, orderId);
  if (!order) {
    notFound();
  }

  return (
    <>
      {/* Minimal styles for print page */}
      <style>{`
        @media screen {
          body {
            background: #f5f5f5;
            display: flex;
            justify-content: center;
            padding: 20px;
          }
          .print-receipt {
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
        }
        @media print {
          body {
            background: white;
            margin: 0;
            padding: 0;
          }
          .print-only {
            display: block !important;
          }
        }
        .print-only {
          display: block;
        }
      `}</style>

      <OrderPrintReceipt
        order={order}
        storeName={store.name}
        storeLogo={store.logoUrl}
        storePhone={store.contactPhone}
        storeEmail={store.contactEmail}
        currency={store.currency}
        receiptSettings={{
          paperWidth: store.receiptPaperWidth,
          showLogo: store.receiptShowLogo,
          showContact: store.receiptShowContact,
          footerText: store.receiptFooterText,
        }}
      />
    </>
  );
}
