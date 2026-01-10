import { MapPin, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getUser } from "@/lib/auth/server";
import { getUserAddresses } from "@/lib/db/queries/addresses";
import { AddressCard } from "@/components/store/account/address-card";
import { AddAddressButton } from "@/components/store/account/add-address-button";

export default async function AddressesPage() {
  const user = await getUser();

  // Shouldn't happen due to layout protection, but just in case
  if (!user) {
    return null;
  }

  const addresses = await getUserAddresses(user.id);

  return (
    <div className="space-y-4">
      {/* Info Alert */}
      <Alert>
        <Info className="size-4" />
        <AlertDescription>
          Your addresses are saved to your account and can be used at any store
          on Kaka Malem. Changes here will apply everywhere.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            <MapPin className="size-5" />
            Saved Addresses
          </CardTitle>
          <AddAddressButton userName={user.name} />
        </CardHeader>
        <CardContent>
          {addresses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MapPin className="size-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">No addresses saved</h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-sm">
                Add addresses to speed up checkout. Your addresses work at any
                store on Kaka Malem.
              </p>
              <div className="mt-4">
                <AddAddressButton
                  variant="default"
                  showIcon
                  userName={user.name}
                />
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {addresses.map((address) => (
                <AddressCard
                  key={address.id}
                  address={address}
                  userName={user.name}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
