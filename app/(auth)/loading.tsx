import { Spinner } from "@/components/ui/spinner";

export default function AuthLoading() {
  return (
    <div className="space-y-6 text-center">
      <Spinner size="lg" className="mx-auto" />
      <p className="text-sm text-muted-foreground">Loading...</p>
    </div>
  );
}
