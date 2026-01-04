import { AuthStatusCard } from "@/components/auth/auth-status-card";

export default function AuthLoading() {
  return (
    <AuthStatusCard
      variant="loading"
      title="Loading..."
      description="Please wait while we prepare your page."
    />
  );
}
