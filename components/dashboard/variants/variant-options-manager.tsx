"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

import type { VariantOptionWithValues } from "@/lib/db/queries/variants";
import {
  createVariantOptionWithValues,
  updateVariantOption,
  deleteVariantOption,
  addVariantOptionValue,
  updateVariantOptionValue,
  deleteVariantOptionValue,
} from "@/lib/actions/variants";

interface VariantOptionsManagerProps {
  tenantId: string;
  variantOptions: VariantOptionWithValues[];
}

export function VariantOptionsManager({
  tenantId,
  variantOptions,
}: VariantOptionsManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedOption, setSelectedOption] =
    useState<VariantOptionWithValues | null>(null);

  // Form states
  const [newOptionName, setNewOptionName] = useState("");
  const [newOptionValues, setNewOptionValues] = useState<string[]>([""]);
  const [editOptionName, setEditOptionName] = useState("");

  // Inline value editing states
  const [addingValueToOption, setAddingValueToOption] = useState<string | null>(
    null
  );
  const [newValueInput, setNewValueInput] = useState("");
  const [editingValue, setEditingValue] = useState<{
    optionId: string;
    valueId: string;
    value: string;
  } | null>(null);

  const resetCreateForm = () => {
    setNewOptionName("");
    setNewOptionValues([""]);
  };

  const handleCreateOption = async () => {
    // Filter out empty values
    const values = newOptionValues
      .map((v) => v.trim())
      .filter((v) => v.length > 0);

    if (!newOptionName.trim()) {
      toast.error("Option name is required");
      return;
    }

    if (values.length === 0) {
      toast.error("At least one value is required");
      return;
    }

    const result = await createVariantOptionWithValues(tenantId, {
      name: newOptionName.trim(),
      displayOrder: variantOptions.length,
      values: values.map((v, i) => ({ value: v, displayOrder: i })),
    });

    if (result.success) {
      toast.success("Variant option created");
      setCreateDialogOpen(false);
      resetCreateForm();
      startTransition(() => router.refresh());
    } else {
      toast.error(result.error?.message || "Failed to create option");
    }
  };

  const handleUpdateOption = async () => {
    if (!selectedOption) return;

    if (!editOptionName.trim()) {
      toast.error("Option name is required");
      return;
    }

    const result = await updateVariantOption(tenantId, selectedOption.id, {
      name: editOptionName.trim(),
      displayOrder: selectedOption.displayOrder,
    });

    if (result.success) {
      toast.success("Variant option updated");
      setEditDialogOpen(false);
      setSelectedOption(null);
      startTransition(() => router.refresh());
    } else {
      toast.error(result.error?.message || "Failed to update option");
    }
  };

  const handleDeleteOption = async () => {
    if (!selectedOption) return;

    const result = await deleteVariantOption(tenantId, selectedOption.id);

    if (result.success) {
      toast.success("Variant option deleted");
      setDeleteDialogOpen(false);
      setSelectedOption(null);
      startTransition(() => router.refresh());
    } else {
      toast.error(result.error?.message || "Failed to delete option");
    }
  };

  const handleAddValue = async (optionId: string) => {
    if (!newValueInput.trim()) {
      toast.error("Value is required");
      return;
    }

    const option = variantOptions.find((o) => o.id === optionId);
    const result = await addVariantOptionValue(tenantId, optionId, {
      value: newValueInput.trim(),
      displayOrder: option?.values.length || 0,
    });

    if (result.success) {
      toast.success("Value added");
      setAddingValueToOption(null);
      setNewValueInput("");
      startTransition(() => router.refresh());
    } else {
      toast.error(result.error?.message || "Failed to add value");
    }
  };

  const handleUpdateValue = async () => {
    if (!editingValue) return;

    if (!editingValue.value.trim()) {
      toast.error("Value is required");
      return;
    }

    const option = variantOptions.find((o) => o.id === editingValue.optionId);
    const valueData = option?.values.find((v) => v.id === editingValue.valueId);

    const result = await updateVariantOptionValue(
      tenantId,
      editingValue.valueId,
      {
        value: editingValue.value.trim(),
        displayOrder: valueData?.displayOrder || 0,
      }
    );

    if (result.success) {
      toast.success("Value updated");
      setEditingValue(null);
      startTransition(() => router.refresh());
    } else {
      toast.error(result.error?.message || "Failed to update value");
    }
  };

  const handleDeleteValue = async (valueId: string) => {
    const result = await deleteVariantOptionValue(tenantId, valueId);

    if (result.success) {
      toast.success("Value deleted");
      startTransition(() => router.refresh());
    } else {
      toast.error(result.error?.message || "Failed to delete value");
    }
  };

  const addNewValueInput = () => {
    setNewOptionValues([...newOptionValues, ""]);
  };

  const updateNewValueInput = (index: number, value: string) => {
    const updated = [...newOptionValues];
    updated[index] = value;
    setNewOptionValues(updated);
  };

  const removeNewValueInput = (index: number) => {
    if (newOptionValues.length > 1) {
      setNewOptionValues(newOptionValues.filter((_, i) => i !== index));
    }
  };

  return (
    <>
      <div className="space-y-4">
        {/* Add Option Button */}
        <div className="flex justify-end">
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 size-4" />
            Add Option
          </Button>
        </div>

        {/* Options List */}
        {variantOptions.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="mb-4 text-center text-muted-foreground">
                No variant options yet. Create options like Size, Color, or
                Material to use in your products.
              </p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="mr-2 size-4" />
                Create your first option
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {variantOptions.map((option) => (
              <Card key={option.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base font-medium">
                    {option.name}
                  </CardTitle>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        setSelectedOption(option);
                        setEditOptionName(option.name);
                        setEditDialogOpen(true);
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        setSelectedOption(option);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {option.values.map((value) => (
                      <div key={value.id} className="group relative">
                        {editingValue?.valueId === value.id ? (
                          <div className="flex items-center gap-1">
                            <Input
                              value={editingValue.value}
                              onChange={(e) =>
                                setEditingValue({
                                  ...editingValue,
                                  value: e.target.value,
                                })
                              }
                              className="h-7 w-24"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleUpdateValue();
                                if (e.key === "Escape") setEditingValue(null);
                              }}
                            />
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={handleUpdateValue}
                            >
                              <Check className="size-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setEditingValue(null)}
                            >
                              <X className="size-3" />
                            </Button>
                          </div>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="cursor-pointer pr-1"
                          >
                            <span
                              onClick={() =>
                                setEditingValue({
                                  optionId: option.id,
                                  valueId: value.id,
                                  value: value.value,
                                })
                              }
                            >
                              {value.value}
                            </span>
                            <button
                              onClick={() => handleDeleteValue(value.id)}
                              className="ml-1 rounded-full p-0.5 hover:bg-muted"
                            >
                              <X className="size-3" />
                            </button>
                          </Badge>
                        )}
                      </div>
                    ))}

                    {/* Add Value Inline */}
                    {addingValueToOption === option.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={newValueInput}
                          onChange={(e) => setNewValueInput(e.target.value)}
                          placeholder="Value"
                          className="h-7 w-24"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleAddValue(option.id);
                            if (e.key === "Escape") {
                              setAddingValueToOption(null);
                              setNewValueInput("");
                            }
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleAddValue(option.id)}
                        >
                          <Check className="size-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            setAddingValueToOption(null);
                            setNewValueInput("");
                          }}
                        >
                          <X className="size-3" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => setAddingValueToOption(option.id)}
                      >
                        <Plus className="mr-1 size-3" />
                        Add
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Option Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Variant Option</DialogTitle>
            <DialogDescription>
              Create a new variant option like Size, Color, or Material.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="optionName">Option Name</Label>
              <Input
                id="optionName"
                value={newOptionName}
                onChange={(e) => setNewOptionName(e.target.value)}
                placeholder="e.g., Size, Color, Material"
              />
            </div>
            <div className="space-y-2">
              <Label>Values</Label>
              <div className="space-y-2">
                {newOptionValues.map((value, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={value}
                      onChange={(e) =>
                        updateNewValueInput(index, e.target.value)
                      }
                      placeholder={`Value ${index + 1}`}
                    />
                    {newOptionValues.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeNewValueInput(index)}
                      >
                        <X className="size-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addNewValueInput}
                >
                  <Plus className="mr-2 size-4" />
                  Add Value
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
                resetCreateForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateOption} disabled={isPending}>
              Create Option
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Option Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Option Name</DialogTitle>
            <DialogDescription>
              Update the name of this variant option.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editOptionName">Option Name</Label>
              <Input
                id="editOptionName"
                value={editOptionName}
                onChange={(e) => setEditOptionName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateOption} disabled={isPending}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Variant Option</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{selectedOption?.name}
              &quot;? This will also remove all its values and may affect
              products using this option.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDeleteOption}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
