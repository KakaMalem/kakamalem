import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";

export default function TeamSettingsPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>
                People who have access to manage this store.
              </CardDescription>
            </div>
            <Button size="sm">
              <UserPlus className="mr-2 h-4 w-4" />
              Invite Member
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">
              No team members yet. Invite people to help manage your store.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Roles</CardTitle>
          <CardDescription>
            Understanding permission levels for team members.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium">Owner</p>
                <p className="text-muted-foreground">
                  Full access including billing and danger zone
                </p>
              </div>
            </div>
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium">Admin</p>
                <p className="text-muted-foreground">
                  Can manage products, orders, and settings
                </p>
              </div>
            </div>
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium">Staff</p>
                <p className="text-muted-foreground">
                  Can manage products and view orders
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
