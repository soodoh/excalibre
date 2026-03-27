// oxlint-disable typescript/no-unsafe-call
import type { JSX } from "react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "src/components/ui/dialog";
import { Button } from "src/components/ui/button";
import { Input } from "src/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "src/components/ui/form";
import { createShelfSchema } from "src/lib/validators";
import type { CreateShelfInput } from "src/lib/validators";
import { createShelfFn, updateShelfFn } from "src/server/shelves";
import { queryKeys } from "src/lib/query-keys";
import { SmartFilterBuilder } from "src/components/organization/smart-filter-builder";
import type { FilterRules } from "src/components/organization/smart-filter-builder";

type Shelf = {
  id: number;
  name: string;
  type: "smart" | "manual";
  filterRules?: Record<string, unknown> | null;
};

type ShelfFormProps = {
  shelf?: Shelf;
  trigger: React.ReactNode;
};

const DEFAULT_FILTER_RULES: FilterRules = {
  operator: "and",
  conditions: [],
};

function parseFilterRules(
  raw: Record<string, unknown> | null | undefined,
): FilterRules {
  if (!raw) {
    return DEFAULT_FILTER_RULES;
  }
  const operator = raw.operator === "or" ? "or" : ("and" as const);
  const conditions = Array.isArray(raw.conditions)
    ? (raw.conditions as FilterRules["conditions"])
    : [];
  return { operator, conditions };
}

export function ShelfForm({ shelf, trigger }: ShelfFormProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [filterRules, setFilterRules] = useState<FilterRules>(
    parseFilterRules(shelf?.filterRules),
  );
  const queryClient = useQueryClient();
  const isEdit = shelf !== undefined;

  const form = useForm<CreateShelfInput>({
    resolver: zodResolver(createShelfSchema),
    defaultValues: {
      name: shelf?.name ?? "",
      type: shelf?.type ?? "manual",
      filterRules: undefined,
    },
  });

  const shelfType = form.watch("type");

  const handleSubmit = async (values: CreateShelfInput): Promise<void> => {
    try {
      const payload = {
        ...values,
        filterRules:
          values.type === "smart"
            ? (filterRules as Record<string, unknown>)
            : undefined,
      };

      if (isEdit) {
        await updateShelfFn({
          data: {
            id: shelf.id,
            name: payload.name,
            filterRules: payload.filterRules,
          },
        });
        toast.success("Shelf updated successfully");
      } else {
        await createShelfFn({ data: payload });
        toast.success("Shelf created successfully");
      }

      await queryClient.invalidateQueries({ queryKey: queryKeys.shelves.all });
      setOpen(false);
      form.reset();
      setFilterRules(DEFAULT_FILTER_RULES);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Something went wrong",
      );
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      form.reset();
      setFilterRules(parseFilterRules(shelf?.filterRules));
    }
  };

  let submitLabel: string;
  if (form.formState.isSubmitting) {
    submitLabel = "Saving...";
  } else if (isEdit) {
    submitLabel = "Save Changes";
  } else {
    submitLabel = "Create Shelf";
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Shelf" : "New Shelf"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="My Shelf" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Type toggle — only show in create mode */}
            {!isEdit && (
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <div className="flex rounded-md border w-fit">
                      <button
                        type="button"
                        onClick={() => field.onChange("manual")}
                        className={`px-4 py-1.5 text-sm rounded-l-md transition-colors ${
                          field.value === "manual"
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted"
                        }`}
                      >
                        Manual
                      </button>
                      <button
                        type="button"
                        onClick={() => field.onChange("smart")}
                        className={`px-4 py-1.5 text-sm rounded-r-md border-l transition-colors ${
                          field.value === "smart"
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted"
                        }`}
                      >
                        Smart
                      </button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Smart filter builder */}
            {shelfType === "smart" && (
              <div className="space-y-2">
                <FormLabel>Filter Rules</FormLabel>
                <SmartFilterBuilder
                  value={filterRules}
                  onChange={setFilterRules}
                />
              </div>
            )}

            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {submitLabel}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
