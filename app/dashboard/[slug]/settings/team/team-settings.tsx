"use client";

import { useState, useTransition } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  UserPlus,
  MoreHorizontal,
  Loader2,
  Shield,
  ShieldCheck,
  Crown,
} from "lucide-react";
import { toast } from "sonner";
import {
  inviteMember,
  updateMemberRole,
  removeMember,
} from "@/lib/supabase/team";
import type { TeamMemberWithProfile } from "@/lib/db/queries/team";

interface TeamSettingsProps {
  storeId: string;
  members: TeamMemberWithProfile[];
  currentUserId: string;
}

const roleIcons = {
  owner: Crown,
  admin: ShieldCheck,
  staff: Shield,
};

const roleLabels = {
  owner: "Owner",
  admin: "Admin",
  staff: "Staff",
};

export function TeamSettings({
  storeId,
  members,
  currentUserId,
}: TeamSettingsProps) {
  const [isPending, startTransition] = useTransition();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "staff">("staff");
  const [emailError, setEmailError] = useState("");

  const isOwner =
    members.find((m) => m.userId === currentUserId)?.role === "owner";

  const handleInvite = () => {
    if (!inviteEmail.trim()) {
      setEmailError("Email is required");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)) {
      setEmailError("Please enter a valid email");
      return;
    }

    setEmailError("");

    startTransition(async () => {
      const result = await inviteMember(
        storeId,
        inviteEmail.trim(),
        inviteRole
      );
      if (result.error) {
        if (result.error.field === "email") {
          setEmailError(result.error.message);
        } else {
          toast.error(result.error.message);
        }
      } else {
        toast.success("Team member added successfully");
        setInviteDialogOpen(false);
        setInviteEmail("");
        setInviteRole("staff");
      }
    });
  };

  const handleRoleChange = (memberId: string, role: "admin" | "staff") => {
    startTransition(async () => {
      const result = await updateMemberRole(storeId, memberId, role);
      if (result.error) {
        toast.error(result.error.message);
      } else {
        toast.success("Role updated successfully");
      }
    });
  };

  const handleRemove = (memberId: string, memberName: string) => {
    if (
      !confirm(`Are you sure you want to remove ${memberName} from the team?`)
    ) {
      return;
    }

    startTransition(async () => {
      const result = await removeMember(storeId, memberId);
      if (result.error) {
        toast.error(result.error.message);
      } else {
        toast.success("Team member removed");
      }
    });
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return email[0].toUpperCase();
  };

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
            {isOwner && (
              <Dialog
                open={inviteDialogOpen}
                onOpenChange={setInviteDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button size="sm">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add Member
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Team Member</DialogTitle>
                    <DialogDescription>
                      Add an existing user to your team by their email address.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="colleague@example.com"
                        value={inviteEmail}
                        onChange={(e) => {
                          setInviteEmail(e.target.value);
                          setEmailError("");
                        }}
                        disabled={isPending}
                      />
                      {emailError && (
                        <p className="text-sm text-destructive">{emailError}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Role</Label>
                      <Select
                        value={inviteRole}
                        onValueChange={(v) =>
                          setInviteRole(v as "admin" | "staff")
                        }
                        disabled={isPending}
                      >
                        <SelectTrigger id="role">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">
                            Admin - Can manage products, orders, and settings
                          </SelectItem>
                          <SelectItem value="staff">
                            Staff - Can manage products and view orders
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setInviteDialogOpen(false)}
                      disabled={isPending}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleInvite} disabled={isPending}>
                      {isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Add Member
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                No team members yet. Add people to help manage your store.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {members.map((member) => {
                const RoleIcon = roleIcons[member.role];
                const isCurrentUser = member.userId === currentUserId;

                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={member.user.avatarUrl || undefined} />
                        <AvatarFallback>
                          {getInitials(member.user.fullName, member.user.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {member.user.fullName || member.user.email}
                          </span>
                          {isCurrentUser && (
                            <Badge variant="secondary" className="text-xs">
                              You
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {member.user.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="gap-1">
                        <RoleIcon className="h-3 w-3" />
                        {roleLabels[member.role]}
                      </Badge>
                      {isOwner && member.role !== "owner" && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={isPending}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                handleRoleChange(
                                  member.id,
                                  member.role === "admin" ? "staff" : "admin"
                                )
                              }
                            >
                              Change to{" "}
                              {member.role === "admin" ? "Staff" : "Admin"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() =>
                                handleRemove(
                                  member.id,
                                  member.user.fullName || member.user.email
                                )
                              }
                              className="text-destructive focus:text-destructive"
                            >
                              Remove from team
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-amber-500" />
                <div>
                  <p className="font-medium">Owner</p>
                  <p className="text-muted-foreground">
                    Full access including billing and danger zone
                  </p>
                </div>
              </div>
            </div>
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-500" />
                <div>
                  <p className="font-medium">Admin</p>
                  <p className="text-muted-foreground">
                    Can manage products, orders, and settings
                  </p>
                </div>
              </div>
            </div>
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="font-medium">Staff</p>
                  <p className="text-muted-foreground">
                    Can manage products and view orders
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
