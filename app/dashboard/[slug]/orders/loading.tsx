import { OrdersPageSkeleton } from "@/components/dashboard/orders/orders-list-skeleton";

export default function OrdersLoading() {
  return <OrdersPageSkeleton itemCount={8} />;
}
