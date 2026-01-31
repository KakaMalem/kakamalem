"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { AlertCircle, Check, MapPin } from "lucide-react";
import { LocationPicker, type LocationValue } from "@/components/shared";
import { updateStoreLocation } from "@/lib/actions/stores";
import { toast } from "sonner";

interface LocationSettingsFormProps {
  storeId: string;
  storeSlug: string;
  initialData: {
    storeLocationLat: number | null;
    storeLocationLng: number | null;
    storeLocationCity: string;
    storeLocationPlusCode: string;
    storeLocationAccuracy: number | null;
    storeLocationSource: "gps" | "manual" | null;
  };
}

export function LocationSettingsForm({
  storeId,
  storeSlug,
  initialData,
}: LocationSettingsFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Location state
  const [location, setLocation] = useState<LocationValue | null>(() => {
    if (
      initialData.storeLocationLat !== null &&
      initialData.storeLocationLng !== null
    ) {
      return {
        latitude: initialData.storeLocationLat,
        longitude: initialData.storeLocationLng,
        city: initialData.storeLocationCity || undefined,
        plusCode: initialData.storeLocationPlusCode || undefined,
        accuracy: initialData.storeLocationAccuracy || undefined,
        source: initialData.storeLocationSource || "manual",
      };
    }
    return null;
  });

  // Track if form has unsaved changes
  const hasChanges = (() => {
    if (location === null) {
      return initialData.storeLocationLat !== null;
    }
    return (
      location.latitude !== initialData.storeLocationLat ||
      location.longitude !== initialData.storeLocationLng
    );
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      const result = await updateStoreLocation(storeId, storeSlug, {
        storeLocationLat: location?.latitude ?? null,
        storeLocationLng: location?.longitude ?? null,
        storeLocationCity: location?.city || null,
        storeLocationPlusCode: location?.plusCode || null,
        storeLocationAccuracy: location?.accuracy ?? null,
        storeLocationSource: location?.source ?? null,
      });

      if (result.error) {
        setError(result.error.message);
        toast.error(result.error.message);
        return;
      }

      setSuccess(true);
      toast.success("Location updated successfully");
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Store Location
          </CardTitle>
          <CardDescription>
            Set your store&apos;s physical location. This helps customers find
            you and can be used for local delivery calculations.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-200 bg-green-50 text-green-800">
              <Check className="h-4 w-4" />
              <AlertDescription>Location saved successfully!</AlertDescription>
            </Alert>
          )}

          <LocationPicker
            value={location}
            onChange={setLocation}
            disabled={isPending}
            showGPSButton={true}
            showClearButton={true}
          />
        </CardContent>

        <CardFooter className="flex justify-between border-t pt-6">
          <p className="text-sm text-muted-foreground">
            {location
              ? "Your store location is set. Customers can find you on the map."
              : "No location set. Add your store location to help customers find you."}
          </p>
          <Button type="submit" disabled={isPending || !hasChanges}>
            {isPending && <Spinner className="mr-2" />}
            {isPending ? "Saving..." : "Save Location"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
