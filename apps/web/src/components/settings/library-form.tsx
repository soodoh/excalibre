// oxlint-disable typescript/no-unsafe-call
import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PlusIcon, XIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "src/components/ui/dialog";
import { Button } from "src/components/ui/button";
import { Input } from "src/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "src/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "src/components/ui/form";
import { createLibrarySchema } from "src/lib/validators";
import type { CreateLibraryInput } from "src/lib/validators";
import { createLibraryFn, updateLibraryFn } from "src/server/libraries";
import { queryKeys } from "src/lib/query-keys";

type Library = {
  id: number;
  name: string;
  type: string;
  scanPaths: string[];
  scanInterval: number;
};

type LibraryFormProps = {
  library?: Library;
  trigger: React.ReactNode;
};

export function LibraryForm({
  library,
  trigger,
}: LibraryFormProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const isEdit = library !== undefined;

  const form = useForm<CreateLibraryInput>({
    resolver: zodResolver(createLibrarySchema),
    defaultValues: {
      name: library?.name ?? "",
      type: (library?.type as "book" | "comic" | "manga") ?? "book",
      scanPaths: library?.scanPaths.length ? library.scanPaths : [""],
      scanInterval: library?.scanInterval ?? 30,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    // @ts-expect-error react-hook-form field array with string[] field
    name: "scanPaths",
  });

  const handleSubmit = async (values: CreateLibraryInput): Promise<void> => {
    try {
      if (isEdit) {
        await updateLibraryFn({ data: { id: library.id, ...values } });
        toast.success("Library updated successfully");
      } else {
        await createLibraryFn({ data: values });
        toast.success("Library created successfully");
      }
      await queryClient.invalidateQueries({
        queryKey: queryKeys.libraries.all,
      });
      setOpen(false);
      form.reset();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Something went wrong",
      );
    }
  };

  let submitLabel: string;
  if (form.formState.isSubmitting) {
    submitLabel = "Saving...";
  } else if (isEdit) {
    submitLabel = "Save Changes";
  } else {
    submitLabel = "Create Library";
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Library" : "Add Library"}</DialogTitle>
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
                    <Input placeholder="My Library" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => {
                const handleTypeChange = (value: string): void => {
                  field.onChange(value);
                };
                return (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select
                      onValueChange={handleTypeChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="book">Book</SelectItem>
                        <SelectItem value="comic">Comic</SelectItem>
                        <SelectItem value="manga">Manga</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <div className="space-y-2">
              <FormLabel>Scan Paths</FormLabel>
              {fields.map((field, index) => (
                <FormField
                  key={field.id}
                  control={form.control}
                  name={`scanPaths.${index}`}
                  render={({ field: inputField }) => (
                    <FormItem>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input placeholder="/path/to/books" {...inputField} />
                        </FormControl>
                        {fields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => remove(index)}
                          >
                            <XIcon />
                            <span className="sr-only">Remove path</span>
                          </Button>
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
              {form.formState.errors.scanPaths?.root && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.scanPaths.root.message}
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append("")}
              >
                <PlusIcon />
                Add Path
              </Button>
            </div>

            <FormField
              control={form.control}
              name="scanInterval"
              render={({ field }) => {
                const handleIntervalChange = (
                  e: React.ChangeEvent<HTMLInputElement>,
                ): void => {
                  field.onChange(e.target.valueAsNumber);
                };
                return (
                  <FormItem>
                    <FormLabel>Scan Interval (minutes)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        {...field}
                        onChange={handleIntervalChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

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
