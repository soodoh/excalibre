// oxlint-disable typescript/no-unsafe-call

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import type { JSX } from "react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "src/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "src/components/ui/dialog";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "src/components/ui/form";
import { Input } from "src/components/ui/input";
import { queryKeys } from "src/lib/query-keys";
import type { CreateCollectionInput } from "src/lib/validators";
import { createCollectionSchema } from "src/lib/validators";
import { createCollectionFn, updateCollectionFn } from "src/server/collections";

type Collection = {
	id: number;
	name: string;
};

type CollectionFormProps = {
	collection?: Collection;
	trigger: React.ReactNode;
};

export function CollectionForm({
	collection,
	trigger,
}: CollectionFormProps): JSX.Element {
	const [open, setOpen] = useState(false);
	const queryClient = useQueryClient();
	const isEdit = collection !== undefined;

	const form = useForm<CreateCollectionInput>({
		resolver: zodResolver(createCollectionSchema),
		defaultValues: {
			name: collection?.name ?? "",
		},
	});

	const handleSubmit = async (values: CreateCollectionInput): Promise<void> => {
		try {
			if (isEdit) {
				await updateCollectionFn({ data: { id: collection.id, ...values } });
				toast.success("Collection updated successfully");
			} else {
				await createCollectionFn({ data: values });
				toast.success("Collection created successfully");
			}

			await queryClient.invalidateQueries({
				queryKey: queryKeys.collections.all,
			});
			setOpen(false);
			form.reset();
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
		}
	};

	let submitLabel: string;
	if (form.formState.isSubmitting) {
		submitLabel = "Saving...";
	} else if (isEdit) {
		submitLabel = "Save Changes";
	} else {
		submitLabel = "Create Collection";
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>{trigger}</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>
						{isEdit ? "Edit Collection" : "New Collection"}
					</DialogTitle>
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
										<Input placeholder="My Collection" {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
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
